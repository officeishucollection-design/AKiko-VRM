import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Key,
  CheckCircle,
  AlertCircle,
  Table,
  ArrowRight,
  ClipboardList,
  Sparkles,
  Filter,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { CsvData, SkipRule, SkipOperator } from '../../types';
import { api } from '../../services/api';
import { shouldSkipRow } from '../../utils/filterUtils';

interface Step1CsvUploadProps {
  csvData: CsvData | null;
  csvFilename: string;
  primaryKey: string;
  skipRules: SkipRule[];
  onCsvLoaded: (data: CsvData, filename: string, selectedKey: string) => void;
  onUpdateSkipRules: (rules: SkipRule[]) => void;
  onNext: () => void;
}

export const Step1CsvUpload: React.FC<Step1CsvUploadProps> = ({
  csvData,
  csvFilename,
  primaryKey,
  skipRules = [],
  onCsvLoaded,
  onUpdateSkipRules,
  onNext,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showFilterRules, setShowFilterRules] = useState(skipRules.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isAllowed = lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.tsv') || lower.endsWith('.txt');
    if (!isAllowed) {
      setError('Please upload a valid CSV (.csv) or Excel (.xlsx/.xls) file');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.uploadCsv(file);
      const chosenKey = res.data.suggestedPrimaryKey || res.data.headers[0] || '';
      onCsvLoaded(res.data, res.filename, chosenKey);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to parse file');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.uploadCsvText(pastedText);
      const chosenKey = res.data.suggestedPrimaryKey || res.data.headers[0] || '';
      onCsvLoaded(res.data, 'pasted-data.csv', chosenKey);
      setShowPasteModal(false);
      setPastedText('');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to parse pasted CSV text');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleAddRule = (column?: string, operator: SkipOperator = 'equals', value: string = '') => {
    const newRule: SkipRule = {
      id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      column: column || (csvData?.headers[0] || ''),
      operator,
      value,
      enabled: true,
    };
    onUpdateSkipRules([...skipRules, newRule]);
    setShowFilterRules(true);
  };

  const handleUpdateRule = (id: string, updates: Partial<SkipRule>) => {
    onUpdateSkipRules(skipRules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleDeleteRule = (id: string) => {
    onUpdateSkipRules(skipRules.filter(r => r.id !== id));
  };

  const allRows = csvData?.rows || [];
  const skippedRowCount = allRows.filter(r => shouldSkipRow(r, skipRules)).length;
  const activeRowCount = allRows.length - skippedRowCount;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              1
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Upload Product Dataset (CSV or Excel)
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Provide the base CSV or Excel file containing your product information.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all cursor-pointer"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Paste Raw CSV
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
            : csvData
            ? 'border-slate-700 bg-slate-900/40 hover:border-emerald-500/60'
            : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Upload className={`w-7 h-7 ${isLoading ? 'animate-bounce' : ''}`} />
          </div>

          <div>
            <p className="text-base font-semibold text-slate-200">
              {isLoading ? 'Parsing dataset...' : csvData ? 'Replace Dataset File' : 'Drop your CSV or Excel file here, or browse'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports CSV, TSV, and Excel (.xlsx, .xls) files up to 25MB
            </p>
          </div>

          {csvData && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 rounded-full text-xs font-mono">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Loaded: {csvFilename} ({csvData.totalRows} rows)</span>
            </div>
          )}
        </div>
      </div>

      {/* CSV Preview & Primary Key Selector */}
      {csvData && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Primary Key Selection Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Select Primary Product Identifier
                    <span className="text-[10px] font-normal px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded-full border border-amber-500/30">
                      Required
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    This unique field (e.g. SKU, Handle, Name) matches CSV records to Excel spreadsheet rows and URLs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={primaryKey}
                  onChange={(e) => onCsvLoaded(csvData, csvFilename, e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-emerald-400 text-sm font-semibold rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer"
                >
                  {(csvData.headers || []).map((h) => (
                    <option key={h} value={h} className="bg-slate-900 text-slate-200">
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Row Filter & Skip Rules Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Row Skip Rules
                    <span className="text-[10px] font-normal px-2 py-0.5 bg-purple-500/15 text-purple-300 rounded-full border border-purple-500/30">
                      Optional
                    </span>
                    {skippedRowCount > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
                        {skippedRowCount} Rows Skipped
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Automatically skip rows if a column equals, contains, or is empty.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddRule()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-600/40 rounded-xl transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Skip Rule</span>
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-purple-400" />
                <span>Quick Presets:</span>
              </span>

              {csvData.headers.some(h => h.toLowerCase().includes('sku')) && (
                <button
                  type="button"
                  onClick={() => {
                    const skuCol = csvData.headers.find(h => h.toLowerCase().includes('sku')) || '';
                    if (!skipRules.some(r => r.column === skuCol && r.operator === 'is_empty')) {
                      handleAddRule(skuCol, 'is_empty', '');
                    }
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                >
                  + Skip if SKU is empty
                </button>
              )}

              {csvData.headers.some(h => h.toLowerCase() === 'status') && (
                <button
                  type="button"
                  onClick={() => {
                    const statusCol = csvData.headers.find(h => h.toLowerCase() === 'status') || '';
                    if (!skipRules.some(r => r.column === statusCol && r.value.toLowerCase() === 'draft')) {
                      handleAddRule(statusCol, 'equals', 'Draft');
                    }
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                >
                  + Skip if Status = Draft
                </button>
              )}
            </div>

            {/* Configured Rules List */}
            {skipRules.length > 0 && (
              <div className="space-y-2.5 pt-2">
                {skipRules.map((rule, idx) => {
                  const noValueNeeded = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';
                  return (
                    <div
                      key={rule.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 flex-shrink-0">
                        <span className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span>Skip row if</span>
                      </div>

                      <select
                        value={rule.column}
                        onChange={(e) => handleUpdateRule(rule.id, { column: e.target.value })}
                        className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-500 outline-none cursor-pointer"
                      >
                        {csvData.headers.map((h) => (
                          <option key={h} value={h}>Column: {h}</option>
                        ))}
                      </select>

                      <select
                        value={rule.operator}
                        onChange={(e) => handleUpdateRule(rule.id, { operator: e.target.value as SkipOperator })}
                        className="bg-slate-900 border border-slate-700 text-purple-300 text-xs font-semibold rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-500 outline-none cursor-pointer"
                      >
                        <option value="equals">Equals</option>
                        <option value="not_equals">Does Not Equal</option>
                        <option value="contains">Contains</option>
                        <option value="not_contains">Does Not Contain</option>
                        <option value="is_empty">Is Empty</option>
                        <option value="is_not_empty">Is Not Empty</option>
                      </select>

                      {!noValueNeeded ? (
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                          placeholder="Value..."
                          className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                      ) : (
                        <span className="flex-1 text-xs text-slate-500 italic py-1">(No value needed)</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Spreadsheet Data Grid Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Table className="w-4 h-4 text-emerald-400" />
                <span>CSV Dataset Preview</span>
                <span className="text-slate-500">({activeRowCount} Active Products)</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="px-4 py-2.5">#</th>
                    {(csvData.headers || []).map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {(csvData.preview || csvData.rows?.slice(0, 10) || []).map((row, idx) => {
                    const isSkipped = shouldSkipRow(row, skipRules);
                    return (
                      <tr key={idx} className={`${isSkipped ? 'opacity-40 bg-rose-950/10' : 'hover:bg-slate-800/40'}`}>
                        <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                        {(csvData.headers || []).map((h) => (
                          <td key={h} className="px-4 py-2 text-slate-300">{String(row[h] ?? '')}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end pt-4">
            <button
              onClick={onNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all cursor-pointer"
            >
              <span>Step 2: Upload Excel Template</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Raw Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Paste Raw CSV Text</h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Product ID,Product Name,Category,Brand&#10;101,iPhone 15,Smartphone,Apple&#10;102,Galaxy S24,Smartphone,Samsung"
                rows={10}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                disabled={!pastedText.trim() || isLoading}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                {isLoading ? 'Parsing...' : 'Parse & Load CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
