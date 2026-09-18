import React, { useState, useEffect, useMemo } from 'react';
import {
  Link as LinkIcon,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ClipboardPaste,
  FileSpreadsheet,
  Trash2,
  Play,
  ArrowRight,
  ArrowLeft,
  Search,
  Check,
  AlertTriangle,
  RefreshCw,
  FastForward,
  Info,
  Globe,
  FileText,
  Zap,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import { CsvData, ExcelSheetInfo } from '../../types';
import { api } from '../../services/api';
import Papa from 'papaparse';

/**
 * Creates clean URL slug from product name or text
 */
export function slugify(text: string, mode: 'kebab' | 'lower' | 'raw' = 'kebab'): string {
  if (!text) return '';
  const str = String(text).trim();
  if (mode === 'raw') return encodeURI(str);
  if (mode === 'lower') return str.toLowerCase().replace(/\s+/g, '-');
  // Kebab case (removes special punctuation, accents, trims hyphens)
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Formats a full product URL from a base URL and slug
 */
export function buildProductUrl(baseUrl: string, slug: string): string {
  const cleanBase = (baseUrl || '').trim();
  if (!cleanBase) return '';

  // If baseUrl contains template placeholder {slug}, {name}, or {id}
  if (cleanBase.includes('{slug}') || cleanBase.includes('{name}') || cleanBase.includes('{id}')) {
    return cleanBase
      .replace('{slug}', slug)
      .replace('{name}', slug)
      .replace('{id}', slug);
  }

  // Strip trailing slashes and append /slug
  const baseWithoutTrailing = cleanBase.replace(/\/+$/, '');
  return `${baseWithoutTrailing}/${slug}`;
}

/**
 * Detects if the uploaded CSV already has a URL column
 */
export function detectCsvUrlColumn(headers: string[], rows: Record<string, any>[]): string | null {
  // 1. Direct header match
  const nameMatch = headers.find(h => {
    const l = h.toLowerCase().trim();
    return l === 'url' || l === 'product url' || l === 'product link' || l === 'link' ||
           l === 'webpage' || l === 'product_url' || l === 'product_link' || l === 'website' ||
           l === 'item url' || l === 'item link' || l === 'page url';
  });
  if (nameMatch) return nameMatch;

  // 2. Partial header match (excluding images)
  const partialMatch = headers.find(h => {
    const l = h.toLowerCase().trim();
    return (l.includes('url') || l.includes('link') || l.includes('webpage')) && !l.includes('image') && !l.includes('photo');
  });
  if (partialMatch) return partialMatch;

  // 3. Inspect sample row values for http(s)://
  for (const h of headers) {
    const sample = rows.slice(0, 10).map(r => String(r[h] || '').trim());
    const validHttpCount = sample.filter(s => s.startsWith('http://') || s.startsWith('https://')).length;
    if (validHttpCount >= Math.min(2, sample.length)) {
      return h;
    }
  }

  return null;
}

interface Step4UrlAssignmentProps {
  csvData: CsvData;
  primaryKey: string;
  urlsMap: Record<string, string>;
  excelSheet?: ExcelSheetInfo;
  primaryKeyMapping?: { csvKey: string; excelKey: string; mode: string };
  skipWebExtraction: boolean;
  onUpdateUrls: (urlsMap: Record<string, string>) => void;
  onSetSkipWebExtraction: (skip: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step4UrlAssignment: React.FC<Step4UrlAssignmentProps> = ({
  csvData,
  primaryKey,
  urlsMap,
  excelSheet,
  primaryKeyMapping,
  skipWebExtraction,
  onUpdateUrls,
  onSetSkipWebExtraction,
  onNext,
  onBack,
}) => {
  // Check if CSV (Step 1) already has a URL column
  const detectedCsvUrlCol = useMemo(() => {
    return detectCsvUrlColumn(csvData.headers, csvData.rows);
  }, [csvData]);

  // Check if Excel Template (Step 2) already has a URL column
  const detectedExcelUrlCol = useMemo(() => {
    if (!excelSheet) return null;
    const headerNames = (excelSheet.headers || []).map(h => typeof h === 'string' ? h : h.header);
    const rows = excelSheet.existingRows || excelSheet.previewRows || excelSheet.sampleRows || [];
    return detectCsvUrlColumn(headerNames, rows);
  }, [excelSheet]);

  // Find best default column for product name / slug
  const defaultSlugCol = useMemo(() => {
    const headers = csvData.headers;
    const candidates = ['Product Name', 'Title', 'Handle', 'Name', 'product_name', 'title', 'Item Name', 'Description', primaryKey];
    for (const cand of candidates) {
      const match = headers.find(h => h.trim().toLowerCase() === cand.toLowerCase());
      if (match) return match;
    }
    for (const cand of candidates) {
      const match = headers.find(h => h.toLowerCase().includes(cand.toLowerCase()));
      if (match) return match;
    }
    return headers[0] || primaryKey;
  }, [csvData, primaryKey]);

  const [activeTab, setActiveTab] = useState<'base_url' | 'csv_col' | 'bulk_paste' | 'csv_map' | 'inline'>('base_url');
  const [extractionChoice, setExtractionChoice] = useState<'extract' | 'skip'>('extract');

  // Base URL Generator State
  const [baseUrlInput, setBaseUrlInput] = useState<string>('https://example-store.com/products/');
  const [slugColumn, setSlugColumn] = useState<string>(defaultSlugCol);
  const [slugFormat, setSlugFormat] = useState<'kebab' | 'lower' | 'raw'>('kebab');
  const [baseUrlAppliedNotice, setBaseUrlAppliedNotice] = useState<string | null>(null);

  // Other tools state
  const [selectedCsvCol, setSelectedCsvCol] = useState<string>(detectedCsvUrlCol || csvData.headers[0] || '');
  const [bulkText, setBulkText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'missing'>('all');
  const [testingUrlId, setTestingUrlId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; msg: string }>>({});
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [hasAutoLoadedUrls, setHasAutoLoadedUrls] = useState<boolean>(false);

  // Stats
  const totalProducts = csvData.rows.length;
  const assignedCount = csvData.rows.filter(r => {
    const id = String(r[primaryKey]);
    return urlsMap[id] && urlsMap[id].trim() !== '';
  }).length;
  const missingCount = totalProducts - assignedCount;

  // Auto-detect and populate URLs from Step 1 (CSV) or Step 2 (Excel Template) on mount
  useEffect(() => {
    if (hasAutoLoadedUrls) return;

    const autoMap: Record<string, string> = { ...urlsMap };
    let newFound = 0;
    const effectiveKey = primaryKey || primaryKeyMapping?.csvKey || csvData.headers[0] || 'id';

    // 1. From Step 1 CSV
    if (detectedCsvUrlCol) {
      csvData.rows.forEach(r => {
        const id = String(r[effectiveKey] ?? '');
        const urlVal = String(r[detectedCsvUrlCol] || '').trim();
        if (urlVal && (!autoMap[id] || autoMap[id].trim() === '')) {
          autoMap[id] = urlVal;
          newFound++;
        }
      });
    }

    // 2. From Step 2 Excel Template
    if (detectedExcelUrlCol && excelSheet) {
      const excelRows = excelSheet.existingRows || excelSheet.previewRows || excelSheet.sampleRows || [];
      const excelKey = primaryKeyMapping?.excelKey || (excelSheet.headers[0] ? (typeof excelSheet.headers[0] === 'string' ? excelSheet.headers[0] : excelSheet.headers[0].header) : '');

      csvData.rows.forEach((csvRow, idx) => {
        const id = String(csvRow[effectiveKey] ?? '');
        if (!autoMap[id] || autoMap[id].trim() === '') {
          let matchedRow = null;
          if (excelKey) {
            const searchVal = String(csvRow[effectiveKey] ?? '').trim().toLowerCase();
            matchedRow = excelRows.find((er: any) => String(er[excelKey] || '').trim().toLowerCase() === searchVal);
          }
          if (!matchedRow && excelRows[idx]) {
            matchedRow = excelRows[idx];
          }

          if (matchedRow && matchedRow[detectedExcelUrlCol]) {
            const urlVal = String(matchedRow[detectedExcelUrlCol]).trim();
            if (urlVal) {
              autoMap[id] = urlVal;
              newFound++;
            }
          }
        }
      });
    }

    if (newFound > 0) {
      onUpdateUrls(autoMap);
    }
    setHasAutoLoadedUrls(true);
  }, [detectedCsvUrlCol, detectedExcelUrlCol, excelSheet, csvData, primaryKey, hasAutoLoadedUrls]);

  // Inline URL change
  const handleSingleUrlChange = (id: string, newUrl: string) => {
    const nextMap = { ...urlsMap, [id]: newUrl.trim() };
    onUpdateUrls(nextMap);
  };

  // Generate All URLs from Base URL Pattern
  const handleApplyBaseUrl = () => {
    if (!baseUrlInput.trim()) {
      alert('Please enter a Base URL (e.g. https://your-store.com/products/)');
      return;
    }

    const nextMap: Record<string, string> = { ...urlsMap };
    let count = 0;

    csvData.rows.forEach(row => {
      const id = String(row[primaryKey]);
      const rawSlugValue = String(row[slugColumn] || row['Product Name'] || row['Title'] || id);
      const cleanSlug = slugify(rawSlugValue, slugFormat);
      const fullUrl = buildProductUrl(baseUrlInput, cleanSlug);

      if (fullUrl) {
        nextMap[id] = fullUrl;
        count++;
      }
    });

    onUpdateUrls(nextMap);
    setBaseUrlAppliedNotice(`✓ Generated and applied ${count} product URLs from Base URL!`);
    setTimeout(() => setBaseUrlAppliedNotice(null), 5000);
  };

  // Apply URLs from a specific CSV column
  const handleApplyCsvColumnUrls = (colName: string) => {
    if (!colName) return;
    const nextMap: Record<string, string> = { ...urlsMap };
    let count = 0;

    csvData.rows.forEach(row => {
      const id = String(row[primaryKey]);
      const colVal = String(row[colName] || '').trim();
      if (colVal) {
        nextMap[id] = colVal;
        count++;
      }
    });

    onUpdateUrls(nextMap);
    setBaseUrlAppliedNotice(`✓ Assigned ${count} URLs from CSV column "${colName}"!`);
    setTimeout(() => setBaseUrlAppliedNotice(null), 5000);
  };

  // Bulk Paste Handler
  const handleBulkPasteSubmit = () => {
    const lines = bulkText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const nextMap = { ...urlsMap };
    csvData.rows.forEach((row, idx) => {
      const id = String(row[primaryKey]);
      if (idx < lines.length) {
        nextMap[id] = lines[idx];
      }
    });

    onUpdateUrls(nextMap);
    setActiveTab('inline');
  };

  // URL Mapping CSV Upload Handler
  const handleCsvMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setCsvUploadError('Mapping file contains no valid rows.');
          return;
        }

        const headers = results.meta.fields || [];
        const idCol = headers.find((h: string) => {
          const l = h.toLowerCase();
          return l.includes('id') || l.includes('sku') || l.includes('product');
        }) || headers[0];

        const urlCol = headers.find((h: string) => {
          const l = h.toLowerCase();
          return l.includes('url') || l.includes('link') || l.includes('web');
        }) || headers[1] || headers[0];

        const nextMap = { ...urlsMap };
        let matched = 0;

        (results.data as Record<string, string>[]).forEach(row => {
          const rowId = (row[idCol] || '').trim();
          const rowUrl = (row[urlCol] || '').trim();
          if (rowId && rowUrl) {
            nextMap[rowId] = rowUrl;
            matched++;
          }
        });

        onUpdateUrls(nextMap);
        setCsvUploadError(null);
        setActiveTab('inline');
      },
      error: (err: any) => {
        setCsvUploadError(`Failed to parse CSV: ${err.message}`);
      }
    });
  };

  // Live URL quick test
  const handleTestUrl = async (id: string, url: string, productName: string) => {
    if (!url || !url.startsWith('http')) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, msg: 'Invalid HTTP/HTTPS URL' } }));
      return;
    }

    setTestingUrlId(id);
    try {
      const res = await api.previewExtraction(url, productName);
      const fieldCount = res.meta?.foundFieldsCount || 0;
      setTestResults(prev => ({
        ...prev,
        [id]: { success: true, msg: `✓ Valid (${fieldCount} fields, ${res.elapsedMs}ms)` }
      }));
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [id]: { success: false, msg: `✕ ${err.response?.data?.error || err.message}` }
      }));
    } finally {
      setTestingUrlId(null);
    }
  };

  // Auto-generate sample URLs for testing
  const handleFillDemoUrls = () => {
    const nextMap = { ...urlsMap };
    csvData.rows.forEach(r => {
      const id = String(r[primaryKey]);
      if (!nextMap[id]) {
        const pName = encodeURIComponent((r['Product Name'] || r['title'] || id).toLowerCase().replace(/\s+/g, '-'));
        nextMap[id] = `https://sample-store.mock/products/${pName}`;
      }
    });
    onUpdateUrls(nextMap);
  };

  const handleClearAllUrls = () => {
    if (window.confirm('Clear all assigned product URLs? (Products will use CSV data only)')) {
      onUpdateUrls({});
      setTestResults({});
    }
  };

  // Live sample preview calculation for Base URL generator
  const sampleProduct = csvData.rows[0];
  const sampleRawSlug = sampleProduct ? String(sampleProduct[slugColumn] || sampleProduct['Product Name'] || sampleProduct['Title'] || sampleProduct[primaryKey]) : 'sample-product';
  const sampleCleanSlug = slugify(sampleRawSlug, slugFormat);
  const sampleGeneratedUrl = buildProductUrl(baseUrlInput, sampleCleanSlug);

  // Filtered rows for data table
  const filteredRows = csvData.rows.filter(row => {
    const id = String(row[primaryKey]);
    const name = String(row['Product Name'] || row['title'] || row['Name'] || '');
    const url = urlsMap[id] || '';

    // Search query
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const match = id.toLowerCase().includes(q) || name.toLowerCase().includes(q) || url.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Status filter
    if (statusFilter === 'assigned' && !url) return false;
    if (statusFilter === 'missing' && url) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              4
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Product Webpage URL Hub <span className="text-emerald-400 text-xs font-normal bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 ml-1">Optional</span>
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Provide a Base URL pattern, use CSV URLs, or skip this step to populate Excel using CSV records only.
          </p>
        </div>

        {/* URL Status Progress summary */}
        <div className="flex items-center gap-3">
          {assignedCount === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/70 border border-blue-600/40 text-blue-300 text-xs font-medium">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Mode: CSV Only (0 URLs)</span>
            </span>
          ) : assignedCount === totalProducts ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-600/40 text-emerald-300 text-xs font-medium">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mode: Full Web Enrichment ({assignedCount}/{totalProducts})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 border border-purple-600/40 text-purple-300 text-xs font-medium">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>Mode: Hybrid ({assignedCount} Web / {missingCount} CSV)</span>
            </span>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
            <span className="text-slate-400">Assigned:</span>
            <span className="font-bold font-mono text-emerald-400">
              {assignedCount} / {totalProducts}
            </span>
          </div>
        </div>
      </div>

      {/* DETECTED URL BANNER (If CSV or Excel Template already contains URLs) */}
      {(detectedCsvUrlCol || detectedExcelUrlCol || assignedCount > 0) && (
        <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/50 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-emerald-500/5 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">
                  {assignedCount === totalProducts && totalProducts > 0
                    ? `✓ All ${totalProducts} Product URLs Automatically Loaded!`
                    : `Product URLs Detected (${assignedCount}/${totalProducts} Assigned)`}
                </span>
                {detectedCsvUrlCol && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-semibold border border-emerald-500/30">
                    CSV: {detectedCsvUrlCol}
                  </span>
                )}
                {detectedExcelUrlCol && (
                  <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono text-[10px] font-semibold border border-teal-500/30">
                    Template: {detectedExcelUrlCol}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {assignedCount === totalProducts
                  ? 'All products are ready for web enrichment. You can proceed directly to field mapping without entering URLs.'
                  : 'URLs from your uploaded file were automatically matched. You can proceed directly or refine any missing URLs.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                onSetSkipWebExtraction(false);
                onNext();
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>Proceed to Field Mapping</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                onSetSkipWebExtraction(true);
                onNext();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer whitespace-nowrap"
            >
              <FastForward className="w-3.5 h-3.5 text-slate-400" />
              <span>CSV Only</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Mode Navigation Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab 1: Base URL Generator (Primary) */}
          <button
            onClick={() => setActiveTab('base_url')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'base_url'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ Base URL + /product-name Generator</span>
          </button>

          {/* Tab 2: CSV Column Import */}
          <button
            onClick={() => setActiveTab('csv_col')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'csv_col'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Import from CSV Column</span>
          </button>

          {/* Tab 3: Bulk Paste */}
          <button
            onClick={() => setActiveTab('bulk_paste')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'bulk_paste'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Bulk Paste</span>
          </button>

          {/* Tab 4: CSV Mapping File */}
          <button
            onClick={() => setActiveTab('csv_map')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'csv_map'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>URL Mapping CSV</span>
          </button>

          {/* Tab 5: Inline Table */}
          <button
            onClick={() => setActiveTab('inline')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'inline'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Inline Grid View</span>
          </button>
        </div>

        {/* Quick Utility Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFillDemoUrls}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-300 bg-teal-950/50 hover:bg-teal-900/50 border border-teal-600/40 rounded-xl transition-all cursor-pointer"
            title="Auto-fills empty products with sample live e-commerce test URLs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fill Demo URLs</span>
          </button>

          {assignedCount > 0 && (
            <button
              onClick={handleClearAllUrls}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: ⚡ BASE URL + /PRODUCT-NAME GENERATOR (FASTEST & EASIEST) */}
      {activeTab === 'base_url' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Base URL + Product Slug Builder
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your store's Base URL once. URLs for all {totalProducts} products will be generated by appending the slugified product name.
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 self-start sm:self-auto">
              1-Click Setup for All Products
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Input 1: Base URL */}
            <div className="lg:col-span-6 space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Store Base URL:</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="https://my-store.com/products/"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-300 placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Example: <code>https://mybrand.com/products/</code> or <code>https://shop.com/item/</code>
              </p>
            </div>

            {/* Input 2: Append Field Selector */}
            <div className="lg:col-span-3 space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Append CSV Field:</span>
              </label>
              <select
                value={slugColumn}
                onChange={(e) => setSlugColumn(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                {csvData.headers.map(h => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Column used for the end of the URL
              </p>
            </div>

            {/* Input 3: Slug Transformation Mode */}
            <div className="lg:col-span-3 space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                <span>Slug Format:</span>
              </label>
              <select
                value={slugFormat}
                onChange={(e) => setSlugFormat(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                <option value="kebab">kebab-case (product-name)</option>
                <option value="lower">lowercase with hyphens</option>
                <option value="raw">Raw exact text (encoded)</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Transforms spaces & special characters
              </p>
            </div>
          </div>

          {/* Interactive Live URL Preview Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Generated URL Preview (Row 1):
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Input: "{sampleRawSlug}" → Slug: "{sampleCleanSlug}"
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-300 break-all select-all">
              {sampleGeneratedUrl || <span className="text-slate-600 italic">Enter a Base URL above to see preview</span>}
            </div>
          </div>

          {/* Action Button & Confirmation Message */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div>
              {baseUrlAppliedNotice ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3.5 py-2 rounded-xl">
                  <Check className="w-4 h-4" />
                  <span>{baseUrlAppliedNotice}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  Will assign {totalProducts} product URLs and activate web metadata extraction.
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleApplyBaseUrl}
              disabled={!baseUrlInput.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>⚡ Generate & Apply to All {totalProducts} Products</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: IMPORT FROM CSV COLUMN */}
      {activeTab === 'csv_col' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Select CSV Column Containing Product URLs
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                If your CSV already contains full product URLs or links, select the column below to map them instantly.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            <select
              value={selectedCsvCol}
              onChange={(e) => setSelectedCsvCol(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {csvData.headers.map(h => (
                <option key={h} value={h}>
                  {h} {h === detectedCsvUrlCol ? '(Auto-Detected URL Column)' : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleApplyCsvColumnUrls(selectedCsvCol)}
              disabled={!selectedCsvCol}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              Apply Column URLs
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: BULK URL PASTE */}
      {activeTab === 'bulk_paste' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <ClipboardPaste className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Bulk Paste URLs (Sequential Order)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Paste one URL per line. The URLs will be automatically assigned to your {totalProducts} products in top-to-bottom row order.
              </p>
            </div>
          </div>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            placeholder={`https://store.example.com/product-1\nhttps://store.example.com/product-2\nhttps://store.example.com/product-3`}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">
              Lines detected: {bulkText.split('\n').filter(l => l.trim()).length} / {totalProducts} products
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('base_url')}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkPasteSubmit}
                disabled={!bulkText.trim()}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                Assign Pasted URLs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CSV MAPPING FILE */}
      {activeTab === 'csv_map' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Upload URL Mapping File (CSV)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload a small 2-column CSV mapping file with columns like <code>Product ID, URL</code> or <code>SKU, Webpage</code>.
              </p>
            </div>
          </div>

          <div className="p-6 border-2 border-dashed border-slate-700 bg-slate-950/40 rounded-xl text-center space-y-3">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvMapUpload}
              className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
            />
            {csvUploadError && (
              <p className="text-xs text-rose-400 font-semibold">{csvUploadError}</p>
            )}
          </div>
        </div>
      )}

      {/* Data Table Review Section (Always accessible) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
        {/* Table Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search products or URLs..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 outline-none w-56 sm:w-64"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({totalProducts})
              </button>
              <button
                onClick={() => setStatusFilter('assigned')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'assigned' ? 'bg-emerald-950/80 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Ready ({assignedCount})
              </button>
              <button
                onClick={() => setStatusFilter('missing')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'missing' ? 'bg-amber-950/80 text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                No URL / CSV ({missingCount})
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-400">
            Showing {filteredRows.length} of {totalProducts} Products
          </span>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold w-12 text-slate-500">#</th>
                <th className="px-4 py-3 font-semibold text-emerald-400 w-36">
                  {primaryKey || 'Product / Key'}
                </th>
                {primaryKey && defaultSlugCol && primaryKey.toLowerCase() !== defaultSlugCol.toLowerCase() && (
                  <th className="px-4 py-3 font-semibold text-slate-300 w-48">
                    {defaultSlugCol}
                  </th>
                )}
                <th className="px-4 py-3 font-semibold text-slate-200">
                  Product Webpage URL <span className="text-slate-500 font-normal text-[10px]">(Optional)</span>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-400 w-32 text-center">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold text-slate-400 w-28 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRows.length > 0 ? (
                filteredRows.map((row, idx) => {
                  const id = primaryKey && row[primaryKey] !== undefined ? String(row[primaryKey]) : String(row[csvData.headers[0]] || idx + 1);
                  const name = String(row[defaultSlugCol] || row['Product Name'] || row['Title'] || row['Name'] || id);
                  const currentUrl = urlsMap[id] || '';
                  const hasUrl = currentUrl.trim().length > 0;
                  const isTesting = testingUrlId === id;
                  const testRes = testResults[id];
                  const showSeparateName = primaryKey && defaultSlugCol && primaryKey.toLowerCase() !== defaultSlugCol.toLowerCase();

                  return (
                    <tr
                      key={id || idx}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                        {id}
                      </td>

                      {showSeparateName && (
                        <td className="px-4 py-3 text-slate-200 font-medium">
                          <div className="truncate max-w-[200px]" title={name}>
                            {name}
                          </div>
                        </td>
                      )}

                      {/* URL Input Cell */}
                      <td className="px-4 py-2">
                        <div className="relative">
                          <input
                            type="url"
                            placeholder="Optional: https://example.com/products/slug..."
                            value={currentUrl}
                            onChange={(e) => handleSingleUrlChange(id, e.target.value)}
                            className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${
                              hasUrl
                                ? 'border-slate-700 hover:border-slate-600 text-emerald-300'
                                : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Status Badge & Test Result */}
                      <td className="px-4 py-3 text-center">
                        {isTesting ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-400 animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Testing...
                          </span>
                        ) : testRes ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              testRes.success
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                            }`}
                            title={testRes.msg}
                          >
                            {testRes.msg}
                          </span>
                        ) : hasUrl ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold border border-slate-700" title="Optional: CSV data will be used for this product">
                            Optional / CSV
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasUrl && (
                            <>
                              <button
                                onClick={() => handleTestUrl(id, currentUrl, name)}
                                disabled={isTesting}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                                title="Test webpage extraction for this URL"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>

                              <a
                                href={currentUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
                                title="Open URL in new browser tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                    No products match the selected search filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white font-medium text-xs rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Match Products</span>
        </button>

        <div className="flex items-center gap-3">
          {assignedCount === 0 && (
            <span className="text-xs text-slate-400 hidden sm:inline-block">
              Proceeding in CSV-only mode
            </span>
          )}
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <span>Step 5: Configure Field Mapping</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
