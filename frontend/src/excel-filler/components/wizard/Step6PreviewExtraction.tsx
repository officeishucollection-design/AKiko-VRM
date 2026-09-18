import React, { useState, useEffect } from 'react';
import {
  Eye,
  Play,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  FileCode,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Info,
  Check,
} from 'lucide-react';
import { CsvData, FieldMapping } from '../../types';
import { api } from '../../services/api';
import { MethodBadge } from '../common/Badge';
import { ConfidenceMeter } from '../common/ConfidenceMeter';

interface Step6PreviewExtractionProps {
  csvData: CsvData;
  primaryKey: string;
  urlsMap: Record<string, string>;
  fieldMappings: FieldMapping[];
  customSelectors: Record<string, string>;
  skipWebExtraction?: boolean;
  onToggleSkipWebExtraction?: (skip: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step6PreviewExtraction: React.FC<Step6PreviewExtractionProps> = ({
  csvData,
  primaryKey,
  urlsMap,
  fieldMappings,
  customSelectors,
  skipWebExtraction = false,
  onToggleSkipWebExtraction,
  onNext,
  onBack,
}) => {
  // Find products with URLs
  const effectiveKey = primaryKey || csvData.headers[0] || '';
  const productsWithUrls = csvData.rows.filter(r => {
    const id = String(r[effectiveKey] ?? '');
    return (urlsMap[id] && urlsMap[id].trim() !== '') || (r['Product URL'] || r['URL'] || r['Product Link']);
  });

  const [selectedProductId, setSelectedProductId] = useState<string>(
    productsWithUrls[0] ? String(productsWithUrls[0][effectiveKey]) : ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = productsWithUrls.find(
    p => String(p[effectiveKey]) === selectedProductId
  ) || productsWithUrls[0];

  const currentUrl = selectedProduct ? (urlsMap[String(selectedProduct[effectiveKey])] || selectedProduct['Product URL'] || selectedProduct['URL'] || selectedProduct['Product Link'] || '') : '';
  const currentProductName = selectedProduct ? (selectedProduct['Product Name'] || selectedProduct['title'] || selectedProduct[effectiveKey]) : '';

  const hasWebFields = fieldMappings.some(m =>
    m.source === 'Webpage' ||
    m.source === 'CSV (Webpage Fallback)' ||
    m.source === 'Webpage (CSV Fallback)'
  );

  const shouldSkipExtraction = skipWebExtraction || productsWithUrls.length === 0 || !hasWebFields;

  const runTestExtraction = async (url: string, name: string) => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.previewExtraction(url, name, customSelectors);
      setPreviewResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Extraction failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-run first preview on mount ONLY if web extraction is NOT skipped
  useEffect(() => {
    if (!shouldSkipExtraction && currentUrl && !previewResult && !isLoading) {
      runTestExtraction(currentUrl, currentProductName);
    }
  }, [selectedProductId, currentUrl, shouldSkipExtraction]);

  // If extraction is skipped or no web fields mapped
  if (shouldSkipExtraction) {
    return (
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                6
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Preview & Test Webpage Extraction
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Webpage extraction preview is skipped because CSV-only mode is active.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/70 border border-blue-600/40 text-blue-300 text-xs font-medium self-start sm:self-auto">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>CSV Mode Active (No Scraping)</span>
          </span>
        </div>

        {/* CSV Only Informative Hero Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
            <FileSpreadsheet className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="text-xl font-bold text-white">
              Ready for Instant CSV Processing
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              You chose to populate your Excel template directly from your CSV dataset without live web scraping. All {csvData.rows.length} product records and URLs will be populated into your Excel template directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onNext}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-xl shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <span>Proceed to Step 7: Process All Products</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onToggleSkipWebExtraction && (
              <button
                onClick={() => onToggleSkipWebExtraction(false)}
                className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Enable Web Scraping</span>
              </button>
            )}

            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back: Configure Field Mapping</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              6
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Preview & Test Webpage Extraction
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Test and calibrate extraction accuracy with a single product before launching full background processing.
          </p>
        </div>

        <button
          onClick={() => runTestExtraction(currentUrl, currentProductName)}
          disabled={isLoading || !currentUrl}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Extracting Webpage...' : 'Re-Run Test'}</span>
        </button>
      </div>

      {/* Product Selector Ribbon */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">
            Select Sample Product to Test:
          </label>
          <span className="text-[11px] text-slate-500">
            {productsWithUrls.length} products with URLs available
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {productsWithUrls.slice(0, 8).map((prod) => {
            const id = String(prod[primaryKey]);
            const name = prod['Product Name'] || prod['title'] || id;
            const isSelected = id === selectedProductId;

            return (
              <button
                key={id}
                onClick={() => {
                  setSelectedProductId(id);
                  const pUrl = urlsMap[id];
                  runTestExtraction(pUrl, name);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="font-mono text-emerald-400">{id}</span>
                <span className="truncate max-w-[120px]">{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target URL Preview Bar */}
      {selectedProduct && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="font-semibold text-slate-200 truncate">
                {currentProductName}
              </div>
              <div className="font-mono text-emerald-400 truncate">
                {currentUrl}
              </div>
            </div>
          </div>

          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 self-start sm:self-auto transition-all"
          >
            <span>Open Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Error Card */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-2xl text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <div>
            <div className="font-semibold">Webpage Fetch Error</div>
            <div className="text-xs text-rose-400/80 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Extraction Results Grid */}
      {previewResult && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Summary Metric Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Overall Confidence</span>
              <div className="mt-1 flex items-center gap-2">
                <ConfidenceMeter score={previewResult.meta.averageConfidence} />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Extracted Fields</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {previewResult.meta.foundFieldsCount} Fields Found
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Structured Schema</span>
              <span className="text-xs font-semibold text-slate-200">
                {previewResult.meta.hasJsonLd ? '✓ JSON-LD Schema.org' : 'Microdata / OG'}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Response Time</span>
              <span className="text-base font-bold text-cyan-400 font-mono">
                {previewResult.elapsedMs} ms
              </span>
            </div>
          </div>

          {/* Detailed Field-by-Field Inspection Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Extracted Values Breakdown</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Page Title: {previewResult.meta.title}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-slate-400 w-44">
                      Excel Target Column
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-400 w-36">
                      Source Mode
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-emerald-400">
                      Final Value for Excel
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-300 w-40">
                      Extraction Method
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-400 w-32">
                      Confidence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {fieldMappings.map((mapping, idx) => {
                    const { targetColumn, source, csvField, webField } = mapping;
                    const csvVal = csvField ? selectedProduct?.[csvField] : null;
                    const webFieldObj = previewResult.fields[webField || targetColumn];
                    const webVal = webFieldObj?.value;
                    const method = webFieldObj?.method || (source === 'CSV' ? 'CSV Record' : null);
                    const confidence = webFieldObj?.confidence || (source === 'CSV' ? 1.0 : 0);

                    let displayVal: any = '—';
                    if (source === 'CSV') displayVal = csvVal;
                    else if (source === 'Webpage') displayVal = webVal;
                    else if (source === 'CSV (Webpage Fallback)') displayVal = csvVal || webVal;
                    else if (source === 'Webpage (CSV Fallback)') displayVal = webVal || csvVal;
                    else if (source === 'Manual') displayVal = mapping.manualValue;

                    const hasValue = displayVal !== null && displayVal !== undefined && displayVal !== '' && displayVal !== '—';

                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        {/* Excel Column */}
                        <td className="px-4 py-2.5 font-sans font-semibold text-slate-200">
                          {targetColumn}
                        </td>

                        {/* Source Mode */}
                        <td className="px-4 py-2.5 font-sans text-slate-400 text-[11px]">
                          {source}
                        </td>

                        {/* Extracted Value */}
                        <td className="px-4 py-2.5">
                          {hasValue ? (
                            <span className="text-emerald-300 font-semibold bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-500/20 inline-block max-w-md truncate">
                              {String(displayVal)}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic font-sans">not found</span>
                          )}
                        </td>

                        {/* Method */}
                        <td className="px-4 py-2.5">
                          <MethodBadge method={method} />
                        </td>

                        {/* Confidence */}
                        <td className="px-4 py-2.5">
                          {hasValue ? (
                            <ConfidenceMeter score={confidence} size="sm" />
                          ) : (
                            <span className="text-slate-600 text-[11px]">0%</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white font-medium text-xs rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Field Mapping</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <span>Step 7: Launch Background Processing</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
