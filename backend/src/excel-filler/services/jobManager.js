import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { fetchWebpage } from './fetcher.js';
import { extractProductDataFromHtml } from './extractor.js';
import { STATUS, SOURCES } from '../config/constants.js';

class JobManager extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map(); // jobId -> Job instance
  }

  createJob(data = {}) {
    const jobId = uuidv4();
    const {
      csvData = { headers: [], rows: [], totalRows: 0 },
      excelInfo = null,
      sheetName = '',
      primaryKeyMapping = { csvKey: '', excelKey: '', mode: 'identifier' },
      fieldMappings = [],
      products = [], // Array of { id, csvData, url }
      customSelectors = {},
      concurrency = 2,
    } = data;

    // Detect CSV URL column if any
    let csvUrlCol = null;
    if (csvData.headers && Array.isArray(csvData.headers)) {
      csvUrlCol = csvData.headers.find(h => {
        const l = String(h).toLowerCase().trim();
        return l === 'url' || l === 'product url' || l === 'product link' || l === 'link' ||
               l === 'webpage' || l === 'product_url' || l === 'product_link' || l === 'website' ||
               l === 'item url' || l === 'item link' || l === 'page url';
      }) || csvData.headers.find(h => {
        const l = String(h).toLowerCase().trim();
        return (l.includes('url') || l.includes('link') || l.includes('webpage')) && !l.includes('image') && !l.includes('photo');
      });
    }

    // Detect SKU column if present and filter products
    const skuCol = (csvData.headers || []).find(h => {
      const l = String(h).toLowerCase().trim();
      return l === 'variant sku' || l === 'sku' || l === 'item code' || l === 'sku code' || l === 'item sku' || l === 'product sku';
    }) || (csvData.headers || []).find(h => String(h).toLowerCase().includes('sku'));

    const eligibleProducts = skuCol
      ? products.filter(p => {
          const val = p.csvData?.[skuCol] || (p.csvData && Object.entries(p.csvData).find(([k, v]) => k.toLowerCase().includes('sku') && v)?.[1]);
          return val !== undefined && val !== null && String(val).trim() !== '';
        })
      : products;

    // Transform products list
    const items = eligibleProducts.map((p, idx) => {
      const id = p.id || p.csvData?.[primaryKeyMapping.csvKey] || `PROD-${idx + 1}`;
      let url = (p.url || '').trim();
      let excelRowData = p.excelData || null;

      // Check CSV for URL
      if (!url && p.csvData) {
        if (csvUrlCol && p.csvData[csvUrlCol]) {
          url = String(p.csvData[csvUrlCol]).trim();
        } else {
          const fallbackKey = Object.keys(p.csvData).find(k => {
            const l = k.toLowerCase();
            return (l.includes('url') || l.includes('link') || l.includes('webpage') || l.includes('website')) && !l.includes('image');
          });
          if (fallbackKey && p.csvData[fallbackKey]) {
            url = String(p.csvData[fallbackKey]).trim();
          }
        }
      }

      // Check Excel template existing rows for URL & template data
      if (excelInfo && excelInfo.sheets && excelInfo.sheets.length > 0) {
        const sheet = sheetName ? excelInfo.sheets.find(s => s.name === sheetName) : excelInfo.sheets[0];
        if (sheet) {
          const excelRows = sheet.existingRows || sheet.previewRows || sheet.sampleRows || [];
          const excelKey = primaryKeyMapping.excelKey;

          let matchedRow = null;
          if (excelKey) {
            const searchVal = String(p.id || p.csvData?.[primaryKeyMapping.csvKey] || '').trim().toLowerCase();
            matchedRow = excelRows.find(er => String(er[excelKey] || '').trim().toLowerCase() === searchVal);
          }
          if (!matchedRow && excelRows[idx]) {
            matchedRow = excelRows[idx];
          }

          if (matchedRow) {
            excelRowData = matchedRow;
            if (!url) {
              const targetUrlCol = (sheet.headers || []).map(h => typeof h === 'string' ? h : h.header).find(h => {
                const l = String(h).toLowerCase();
                return l.includes('url') || l.includes('link') || l.includes('webpage') || l.includes('website');
              });
              if (targetUrlCol && matchedRow[targetUrlCol]) {
                url = String(matchedRow[targetUrlCol]).trim();
              }
            }
          }
        }
      }

      return {
        id,
        index: idx,
        csvData: p.csvData || {},
        excelData: excelRowData || {},
        url,
        status: STATUS.PENDING,
        error: null,
        extractedFields: {},
        manualOverrides: {},
        conflicts: [],
        chosenSources: {},
        processedAt: null,
        durationMs: 0,
      };
    });

    const job = {
      id: jobId,
      createdAt: new Date().toISOString(),
      state: 'idle', // idle, running, paused, cancelled, completed
      progress: {
        total: items.length,
        completed: 0,
        partial: 0,
        failed: 0,
        urlMissing: items.filter(i => !i.url).length,
        pending: items.length,
        processing: 0,
        percentage: 0,
      },
      currentProduct: null,
      csvData,
      excelInfo,
      excelTemplateBuffer: data.excelTemplateBuffer || null,
      // Keep the worksheet chosen in Step 2 so export writes to the same sheet.
      sheetName,
      primaryKeyMapping,
      fieldMappings,
      customSelectors,
      concurrency: Math.max(1, Math.min(concurrency, 6)),
      skipWebExtraction: Boolean(data.skipWebExtraction),
      items,
      logs: [],
      isPaused: false,
      isCancelled: false,
    };

    this.jobs.set(jobId, job);
    this.recalculateProgress(job);
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).map(j => ({
      id: j.id,
      createdAt: j.createdAt,
      state: j.state,
      progress: j.progress,
      itemCount: j.items.length,
      primaryKey: j.primaryKeyMapping.csvKey,
    }));
  }

  addLog(job, message, level = 'info') {
    const logEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    job.logs.push(logEntry);
    if (job.logs.length > 300) job.logs.shift();
    this.emit(`job:${job.id}:log`, logEntry);
  }

  recalculateProgress(job) {
    const total = job.items.length;
    let completed = 0;
    let partial = 0;
    let failed = 0;
    let urlMissing = 0;
    let pending = 0;
    let processing = 0;

    for (const it of job.items) {
      if (it.status === STATUS.COMPLETED) completed++;
      else if (it.status === STATUS.PARTIAL) partial++;
      else if (it.status === STATUS.FAILED) failed++;
      else if (it.status === STATUS.URL_MISSING) urlMissing++;
      else if (it.status === STATUS.PROCESSING) processing++;
      else pending++;
    }

    const processed = completed + partial + failed;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    job.progress = {
      total,
      completed,
      partial,
      failed,
      urlMissing,
      pending,
      processing,
      percentage,
    };

    this.emit(`job:${job.id}:progress`, {
      state: job.state,
      progress: job.progress,
      currentProduct: job.currentProduct,
    });
  }

  detectConflicts(item, fieldMappings) {
    const conflicts = [];
    fieldMappings.forEach(mapping => {
      const { targetColumn, csvField, webField } = mapping;
      const csvVal = csvField ? item.csvData[csvField] : null;
      const webValObj = item.extractedFields[webField || targetColumn];
      const webVal = webValObj?.value;

      if (csvVal && webVal && String(csvVal).trim().toLowerCase() !== String(webVal).trim().toLowerCase()) {
        conflicts.push({
          field: targetColumn,
          csvValue: csvVal,
          webValue: webVal,
          confidence: webValObj.confidence,
          chosenSource: item.chosenSources[targetColumn] || 'csv',
        });
      }
    });
    item.conflicts = conflicts;
    if (conflicts.length > 0 && item.status === STATUS.COMPLETED) {
      item.status = STATUS.NEEDS_REVIEW;
    }
  }

  async processSingleItem(job, item) {
    if (job.isCancelled) return;

    // Check if any mapped fields actually require live webpage scraping
    const hasWebFields = (job.fieldMappings || []).some(m => {
      const src = m.source;
      return src === SOURCES.WEBPAGE ||
             src === SOURCES.CSV_THEN_WEBPAGE ||
             src === SOURCES.WEBPAGE_THEN_CSV ||
             src === 'Webpage' ||
             src === 'CSV (Webpage Fallback)' ||
             src === 'Webpage (CSV Fallback)';
    });

    // If web extraction was explicitly skipped or if no fields require webpage data or no URL is present
    if (job.skipWebExtraction || !hasWebFields || !item.url || item.url.trim() === '') {
      item.status = STATUS.COMPLETED;
      item.processedAt = new Date().toISOString();
      item.durationMs = 0;
      item.error = null;
      this.detectConflicts(item, job.fieldMappings);
      const reason = job.skipWebExtraction
        ? 'Web extraction skipped by user'
        : (!hasWebFields ? 'All fields mapped from CSV' : 'URL not provided');
      this.addLog(job, `[${item.id}] ✓ Processed from CSV data (${reason})`, 'info');
      this.emit(`job:${job.id}:itemUpdated`, item);
      this.recalculateProgress(job);
      return;
    }

    item.status = STATUS.PROCESSING;
    job.currentProduct = { id: item.id, name: item.csvData?.['Product Name'] || item.id, url: item.url };
    this.recalculateProgress(job);
    this.addLog(job, `[${item.id}] Fetching ${item.url}...`);

    const startTime = Date.now();

    try {
      // 1. Fetch Webpage
      const prodName = item.csvData?.['Product Name'] || item.csvData?.['title'] || item.id;
      const fetchResult = await fetchWebpage(item.url, { customProductName: prodName });

      // 2. Extract Data
      const extraction = extractProductDataFromHtml(fetchResult.html, item.url, job.customSelectors);
      item.extractedFields = extraction.fields;
      item.processedAt = new Date().toISOString();
      item.durationMs = Date.now() - startTime;
      item.error = null;

      // 3. Evaluate Status & Required Fields
      const webFields = job.fieldMappings
        .filter(m => m.source === SOURCES.WEBPAGE || m.source === SOURCES.CSV_THEN_WEBPAGE || m.source === SOURCES.WEBPAGE_THEN_CSV)
        .map(m => m.webField || m.targetColumn);

      let foundRequired = 0;
      let missingRequired = 0;

      webFields.forEach(wf => {
        const val = item.extractedFields[wf]?.value;
        if (val !== null && val !== undefined && val !== '') {
          foundRequired++;
        } else {
          missingRequired++;
        }
      });

      if (webFields.length === 0 || missingRequired === 0) {
        item.status = STATUS.COMPLETED;
        this.addLog(job, `[${item.id}] ✓ Completed (${foundRequired}/${webFields.length} fields extracted) in ${item.durationMs}ms`, 'success');
      } else if (foundRequired > 0) {
        item.status = STATUS.PARTIAL;
        this.addLog(job, `[${item.id}] ⚠ Partial (${foundRequired}/${webFields.length} fields extracted)`, 'warn');
      } else {
        item.status = STATUS.PARTIAL;
        this.addLog(job, `[${item.id}] ⚠ No mapped fields found from webpage`, 'warn');
      }

      // 4. Detect conflicts with CSV
      this.detectConflicts(item, job.fieldMappings);

    } catch (err) {
      const isRateLimited = err.message && (err.message.includes('429') || err.message.includes('Too Many Requests'));
      item.status = STATUS.PARTIAL;
      item.error = err.message || 'Web extraction failed';
      item.durationMs = Date.now() - startTime;
      this.detectConflicts(item, job.fieldMappings);

      if (isRateLimited) {
        this.addLog(job, `[${item.id}] ⚠ Rate limit (HTTP 429). Completed using CSV fallback values.`, 'warn');
      } else {
        this.addLog(job, `[${item.id}] ⚠ Webpage issue (${item.error}). Completed using CSV fallback values.`, 'warn');
      }
    }

    this.emit(`job:${job.id}:itemUpdated`, item);
    this.recalculateProgress(job);
  }

  async startJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    if (job.state === 'running') return;
    job.state = 'running';
    job.isPaused = false;
    job.isCancelled = false;

    this.addLog(job, `🚀 Started job processing with concurrency ${job.concurrency}`);
    this.recalculateProgress(job);

    const pendingItems = job.items.filter(i => i.status === STATUS.PENDING || i.status === STATUS.URL_INVALID || i.status === STATUS.URL_MISSING);

    let activeWorkerCount = 0;
    let nextIndex = 0;

    return new Promise((resolve) => {
      const pump = async () => {
        if (job.isCancelled) {
          job.state = 'cancelled';
          job.currentProduct = null;
          this.recalculateProgress(job);
          this.addLog(job, '⛔ Job was cancelled by user', 'warn');
          resolve(job);
          return;
        }

        if (job.isPaused) {
          job.state = 'paused';
          job.currentProduct = null;
          this.recalculateProgress(job);
          this.addLog(job, '⏸ Job paused');
          resolve(job);
          return;
        }

        if (nextIndex >= pendingItems.length && activeWorkerCount === 0) {
          job.state = 'completed';
          job.currentProduct = null;
          this.recalculateProgress(job);
          this.addLog(job, '✨ Batch processing finished successfully!', 'success');
          resolve(job);
          return;
        }

        while (activeWorkerCount < job.concurrency && nextIndex < pendingItems.length && !job.isPaused && !job.isCancelled) {
          const item = pendingItems[nextIndex++];
          activeWorkerCount++;

          this.processSingleItem(job, item).finally(() => {
            activeWorkerCount--;
            pump();
          });
        }
      };

      pump();
    });
  }

  pauseJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.isPaused = true;
    job.state = 'paused';
    this.recalculateProgress(job);
    return job;
  }

  resumeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.isPaused = false;
    this.startJob(jobId);
    return job;
  }

  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.isCancelled = true;
    job.state = 'cancelled';
    this.recalculateProgress(job);
    return job;
  }

  async retryFailed(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    job.items.forEach(it => {
      if (it.status === STATUS.FAILED || it.status === STATUS.PARTIAL) {
        it.status = STATUS.PENDING;
        it.error = null;
      }
    });

    return this.startJob(jobId);
  }

  async retrySelected(jobId, productIds = []) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    const idSet = new Set(productIds);
    job.items.forEach(it => {
      if (idSet.has(it.id)) {
        it.status = STATUS.PENDING;
        it.error = null;
      }
    });

    return this.startJob(jobId);
  }

  updateItemValue(jobId, productId, fieldKey, value, source = 'manual') {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    const item = job.items.find(i => i.id === productId);
    if (!item) throw new Error('Product item not found');

    item.manualOverrides[fieldKey] = value;
    item.chosenSources[fieldKey] = source;

    if (item.status === STATUS.NEEDS_REVIEW) {
      this.detectConflicts(item, job.fieldMappings);
      if (item.conflicts.length === 0) {
        item.status = STATUS.COMPLETED;
      }
    }

    this.emit(`job:${job.id}:itemUpdated`, item);
    this.recalculateProgress(job);
    return item;
  }

  updateItemUrl(jobId, productId, url) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    const item = job.items.find(i => i.id === productId);
    if (!item) throw new Error('Product item not found');

    item.url = (url || '').trim();
    item.status = STATUS.PENDING;
    item.error = null;

    this.emit(`job:${job.id}:itemUpdated`, item);
    this.recalculateProgress(job);
    return item;
  }

  bulkAssignUrls(jobId, urlList = [], matchMode = 'sequential') {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    urlList.forEach((rawUrl, idx) => {
      const clean = (rawUrl || '').trim();
      if (!clean) return;

      if (idx < job.items.length) {
        job.items[idx].url = clean;
        job.items[idx].status = STATUS.PENDING;
        job.items[idx].error = null;
      }
    });

    this.recalculateProgress(job);
    return job;
  }
}

export const jobManager = new JobManager();
