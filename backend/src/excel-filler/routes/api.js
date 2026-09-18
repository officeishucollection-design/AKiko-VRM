import express from 'express';
import multer from 'multer';
import {
  parseCsv,
  parseExcelToDataset,
  convertCsvToExcelTemplate,
  inspectExcel,
  generatePopulatedExcel,
  generatePopulatedCsv,
} from '../services/spreadsheetService.js';
import { fetchWebpage } from '../services/fetcher.js';
import { extractProductDataFromHtml } from '../services/extractor.js';
import { jobManager } from '../services/jobManager.js';
import {
  SAMPLE_SMARTPHONES,
  createSampleExcelTemplate,
  createSampleCsvString,
  getSampleUrlsMap,
} from '../services/sampleDataService.js';
import { STANDARD_FIELDS } from '../config/constants.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// Cache temporary uploaded Excel templates in-memory by key
const templateStorage = new Map();

/**
 * 1. Upload & Parse Product Dataset (CSV or Excel)
 */
router.post('/upload/csv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file && !req.body.csvText) {
      return res.status(400).json({ success: false, error: 'Please upload a CSV or Excel file or provide csvText' });
    }

    const filename = req.file?.originalname || 'data.csv';
    const lower = filename.toLowerCase();
    const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');

    let parsed;
    if (isExcel && req.file) {
      parsed = await parseExcelToDataset(req.file.buffer);
    } else {
      const content = req.file ? req.file.buffer : req.body.csvText;
      parsed = parseCsv(content);
    }

    res.json({
      success: true,
      filename,
      data: parsed,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Upload & Inspect Template (Excel or CSV)
 */
router.post('/upload/excel', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload an Excel workbook (.xlsx) or CSV template (.csv)' });
    }

    const filename = req.file.originalname;
    const lower = filename.toLowerCase();
    const isCsv = lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv');

    let templateBuffer = req.file.buffer;
    if (isCsv) {
      templateBuffer = await convertCsvToExcelTemplate(req.file.buffer);
    }

    const templateId = 'tpl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    templateStorage.set(templateId, {
      buffer: templateBuffer,
      filename,
      uploadedAt: Date.now(),
    });

    // Cleanup old templates (older than 2 hours)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    for (const [k, v] of templateStorage.entries()) {
      if (v.uploadedAt < twoHoursAgo) templateStorage.delete(k);
    }

    const excelInfo = await inspectExcel(templateBuffer);

    res.json({
      success: true,
      templateId,
      filename: req.file.originalname,
      data: excelInfo,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Test & Preview Extraction for a single URL
 */
router.post('/preview/extract', async (req, res, next) => {
  try {
    const { url, productName = '', customSelectors = {} } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required for preview' });
    }

    const startTime = Date.now();
    const fetchResult = await fetchWebpage(url, { customProductName: productName });
    const extraction = extractProductDataFromHtml(fetchResult.html, url, customSelectors);

    res.json({
      success: true,
      url,
      elapsedMs: Date.now() - startTime,
      isMock: fetchResult.isMock || false,
      meta: extraction.meta,
      fields: extraction.fields,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message || 'Extraction preview failed',
    });
  }
});

/**
 * 4. Get Standard Fields Catalog
 */
router.get('/config/standard-fields', (req, res) => {
  res.json({ success: true, fields: STANDARD_FIELDS });
});

/**
 * 5. Create New Job
 */
router.post('/jobs', async (req, res, next) => {
  try {
    const {
      csvData,
      templateId,
      sheetName,
      primaryKeyMapping,
      fieldMappings,
      products,
      customSelectors,
      concurrency,
      skipWebExtraction,
    } = req.body;

    let excelTemplateBuffer = null;
    let excelInfo = null;

    if (templateId && templateStorage.has(templateId)) {
      excelTemplateBuffer = templateStorage.get(templateId).buffer;
    } else if (req.body.isSample) {
      excelTemplateBuffer = await createSampleExcelTemplate();
    }

    if (excelTemplateBuffer) {
      excelInfo = await inspectExcel(excelTemplateBuffer);
    }

    const job = jobManager.createJob({
      csvData,
      excelInfo,
      excelTemplateBuffer,
      sheetName,
      primaryKeyMapping,
      fieldMappings,
      products,
      customSelectors,
      concurrency,
      skipWebExtraction,
    });

    res.json({
      success: true,
      jobId: job.id,
      job: {
        id: job.id,
        createdAt: job.createdAt,
        state: job.state,
        progress: job.progress,
        itemCount: job.items.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. Get All Jobs
 */
router.get('/jobs', (req, res) => {
  const jobs = jobManager.getAllJobs();
  res.json({ success: true, jobs });
});

/**
 * 7. Get Job Details & Items
 */
router.get('/jobs/:id', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

  res.json({
    success: true,
    job: {
      id: job.id,
      createdAt: job.createdAt,
      state: job.state,
      progress: job.progress,
      currentProduct: job.currentProduct,
      primaryKeyMapping: job.primaryKeyMapping,
      fieldMappings: job.fieldMappings,
      excelInfo: job.excelInfo,
      items: job.items,
      logs: job.logs,
    },
  });
});

/**
 * 8. Real-time Server-Sent Events (SSE) Stream
 */
router.get('/jobs/:id/events', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial snapshot
  res.write(`data: ${JSON.stringify({ type: 'init', progress: job.progress, state: job.state })}\n\n`);

  const onProgress = (data) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', ...data })}\n\n`);
  };

  const onLog = (logEntry) => {
    res.write(`data: ${JSON.stringify({ type: 'log', log: logEntry })}\n\n`);
  };

  const onItemUpdated = (item) => {
    res.write(`data: ${JSON.stringify({ type: 'itemUpdated', item })}\n\n`);
  };

  jobManager.on(`job:${job.id}:progress`, onProgress);
  jobManager.on(`job:${job.id}:log`, onLog);
  jobManager.on(`job:${job.id}:itemUpdated`, onItemUpdated);

  req.on('close', () => {
    jobManager.off(`job:${job.id}:progress`, onProgress);
    jobManager.off(`job:${job.id}:log`, onLog);
    jobManager.off(`job:${job.id}:itemUpdated`, onItemUpdated);
  });
});

/**
 * 9. Start Processing Job
 */
router.post('/jobs/:id/start', async (req, res, next) => {
  try {
    const job = jobManager.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    // Run asynchronously in background
    jobManager.startJob(req.params.id).catch(err => {
      console.error('Job run error:', err);
    });

    res.json({ success: true, message: 'Processing started in background' });
  } catch (err) {
    next(err);
  }
});

/**
 * 10. Pause Job
 */
router.post('/jobs/:id/pause', (req, res) => {
  const job = jobManager.pauseJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, message: 'Job paused' });
});

/**
 * 11. Resume Job
 */
router.post('/jobs/:id/resume', (req, res) => {
  const job = jobManager.resumeJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, message: 'Job resumed' });
});

/**
 * 12. Cancel Job
 */
router.post('/jobs/:id/cancel', (req, res) => {
  const job = jobManager.cancelJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, message: 'Job cancelled' });
});

/**
 * 13. Retry Failed & Partial Items
 */
router.post('/jobs/:id/retry-failed', async (req, res, next) => {
  try {
    jobManager.retryFailed(req.params.id).catch(err => {
      console.error('Retry error:', err);
    });
    res.json({ success: true, message: 'Retrying failed and partial items' });
  } catch (err) {
    next(err);
  }
});

/**
 * 14. Retry Selected Items
 */
router.post('/jobs/:id/retry-selected', async (req, res, next) => {
  try {
    const { productIds = [] } = req.body;
    jobManager.retrySelected(req.params.id, productIds).catch(err => {
      console.error('Retry selected error:', err);
    });
    res.json({ success: true, message: `Retrying ${productIds.length} items` });
  } catch (err) {
    next(err);
  }
});

/**
 * 15. Update Item Cell Value / Manual Override
 */
router.put('/jobs/:id/items/:productId', (req, res) => {
  try {
    const { fieldKey, value, source = 'manual' } = req.body;
    const item = jobManager.updateItemValue(req.params.id, req.params.productId, fieldKey, value, source);
    res.json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 16. Update Single Item URL
 */
router.put('/jobs/:id/items/:productId/url', (req, res) => {
  try {
    const { url } = req.body;
    const item = jobManager.updateItemUrl(req.params.id, req.params.productId, url);
    res.json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 17. Bulk Assign URLs
 */
router.post('/jobs/:id/urls/bulk', (req, res) => {
  try {
    const { urls = [], urlMap = {} } = req.body;
    const job = jobManager.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    if (urls.length > 0) {
      jobManager.bulkAssignUrls(req.params.id, urls);
    } else if (Object.keys(urlMap).length > 0) {
      job.items.forEach(item => {
        if (urlMap[item.id]) {
          item.url = urlMap[item.id].trim();
          item.status = 'Pending';
          item.error = null;
        }
      });
      jobManager.recalculateProgress(job);
    }

    res.json({ success: true, job });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 18. Export Populated Catalog (Excel .xlsx or CSV .csv)
 */
router.post('/jobs/:id/export', async (req, res, next) => {
  try {
    const job = jobManager.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const format = String(req.query.format || req.body.format || 'xlsx').toLowerCase().trim();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'csv') {
      const csvString = generatePopulatedCsv({
        fieldMappings: job.fieldMappings,
        productsData: job.items,
      });

      const filename = `Enriched_Catalog_${timestamp}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvString);
    }

    // Default: XLSX
    let templateBuffer = job.excelTemplateBuffer;
    if (!templateBuffer) {
      templateBuffer = await createSampleExcelTemplate();
    }

    const populatedBuffer = await generatePopulatedExcel(templateBuffer, {
      // Use the worksheet selected during the wizard; only fall back to the
      // first worksheet for older jobs that do not have a saved selection.
      sheetName: job.sheetName || job.excelInfo?.sheets?.[0]?.name,
      fieldMappings: job.fieldMappings,
      productsData: job.items,
      primaryKeyMapping: job.primaryKeyMapping,
    });

    const filename = `Enriched_Catalog_${timestamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(populatedBuffer));
  } catch (err) {
    next(err);
  }
});

/**
 * 19. Load Preconfigured Sample Smartphone Dataset
 */
router.get('/samples/smartphone', async (req, res, next) => {
  try {
    const csvString = createSampleCsvString();
    const csvParsed = parseCsv(csvString);
    const excelBuffer = await createSampleExcelTemplate();
    const excelInfo = await inspectExcel(excelBuffer);
    const urlsMap = getSampleUrlsMap();

    const templateId = 'sample_tpl_' + Date.now();
    templateStorage.set(templateId, {
      buffer: excelBuffer,
      filename: 'Product_Catalog_Template.xlsx',
      uploadedAt: Date.now(),
    });

    // Default field mappings for the sample
    const fieldMappings = [
      { targetColumn: 'SKU Code', source: 'CSV', csvField: 'Product ID', webField: 'sku', dataType: 'string' },
      { targetColumn: 'Product Title', source: 'CSV', csvField: 'Product Name', webField: 'productName', dataType: 'string' },
      { targetColumn: 'Category', source: 'CSV', csvField: 'Category', webField: 'category', dataType: 'string' },
      { targetColumn: 'Manufacturer', source: 'CSV', csvField: 'Brand', webField: 'brand', dataType: 'string' },
      { targetColumn: 'Selling Price (INR)', source: 'Webpage', csvField: '', webField: 'price', dataType: 'currency' },
      { targetColumn: 'MRP (INR)', source: 'Webpage', csvField: '', webField: 'mrp', dataType: 'currency' },
      { targetColumn: 'Item Weight', source: 'Webpage', csvField: '', webField: 'weight', dataType: 'string' },
      { targetColumn: 'Primary Color', source: 'Webpage', csvField: '', webField: 'color', dataType: 'string' },
      { targetColumn: 'Dimensions', source: 'Webpage', csvField: '', webField: 'dimensions', dataType: 'string' },
      { targetColumn: 'Stock Availability', source: 'Webpage', csvField: '', webField: 'availability', dataType: 'string' },
      { targetColumn: 'Detailed Description', source: 'Webpage', csvField: '', webField: 'description', dataType: 'string' },
    ];

    res.json({
      success: true,
      sampleName: 'Smartphones & Flagship Devices Catalog',
      csv: {
        filename: 'products_sample.csv',
        data: csvParsed,
      },
      excel: {
        templateId,
        filename: 'Product_Catalog_Template.xlsx',
        data: excelInfo,
      },
      urlsMap,
      fieldMappings,
      primaryKeyMapping: {
        csvKey: 'Product ID',
        excelKey: 'SKU Code',
        mode: 'identifier',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 20. Download Sample Files
 */
router.get('/samples/download/csv', (req, res) => {
  const csvString = createSampleCsvString();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="products_sample.csv"');
  res.send(csvString);
});

router.get('/samples/download/template', async (req, res, next) => {
  try {
    const buffer = await createSampleExcelTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Product_Catalog_Template.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

export default router;
