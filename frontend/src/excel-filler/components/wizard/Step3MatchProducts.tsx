import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  ArrowRight,
  ArrowLeft,
  Key,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Table,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CsvData, ExcelSheetInfo } from '../../types';

interface Step3MatchProductsProps {
  csvData: CsvData;
  csvPrimaryKey: string;
  excelSheet: ExcelSheetInfo;
  primaryKeyMapping: {
    csvKey: string;
    excelKey: string;
    mode: 'identifier' | 'row_order';
  };
  onUpdateMapping: (mapping: { csvKey: string; excelKey: string; mode: 'identifier' | 'row_order' }) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step3MatchProducts: React.FC<Step3MatchProductsProps> = ({
  csvData,
  csvPrimaryKey,
  excelSheet,
  primaryKeyMapping,
  onUpdateMapping,
  onNext,
  onBack,
}) => {
  const [mode, setMode] = useState<'identifier' | 'row_order'>(primaryKeyMapping.mode || 'identifier');
  const [csvKey, setCsvKey] = useState(primaryKeyMapping.csvKey || csvPrimaryKey);
  const [excelKey, setExcelKey] = useState(() => {
    if (primaryKeyMapping.excelKey) return primaryKeyMapping.excelKey;
    const headersList = excelSheet?.headers || [];
    const found = headersList.find(h => {
      const name = (typeof h === 'string' ? h : h?.header || '').toLowerCase();
      return name.includes('sku') || name.includes('id') || name.includes('code') || name.includes('model') || name.includes('item');
    });
    if (found) return typeof found === 'string' ? found : found.header;
    const first = headersList[0];
    return first ? (typeof first === 'string' ? first : first.header) : '';
  });

  // Sync to parent
  useEffect(() => {
    onUpdateMapping({
      csvKey,
      excelKey,
      mode,
    });
  }, [csvKey, excelKey, mode]);

  // Filter rows so only products with a valid key are considered
  const validCsvRows = (csvData.rows || []).filter(r => {
    if (!csvKey) return true;
    const val = r[csvKey];
    return val !== undefined && val !== null && String(val).trim() !== '';
  });

  // Compute matched count if matching by identifier
  const sheetRows = (excelSheet as any)?.existingRows || excelSheet?.previewRows || (excelSheet as any)?.sampleRows || [];
  const excelExistingKeys = new Set(
    sheetRows.map((r: any) => String(r[excelKey] || '').trim().toLowerCase()).filter(Boolean)
  );

  const matchedPreviewCount = validCsvRows.filter(r =>
    excelExistingKeys.has(String(r[csvKey] || '').trim().toLowerCase())
  ).length;

  const previewList = validCsvRows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              3
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Match CSV Products to Spreadsheet Rows
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Define how products from your CSV correspond to rows in the Excel template.
          </p>
        </div>
      </div>

      {/* Mode Selector Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Identifier Mode */}
        <div
          onClick={() => setMode('identifier')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            mode === 'identifier'
              ? 'bg-emerald-950/20 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                mode === 'identifier' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              }`}>
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Match by Unique Identifier</h3>
                <span className="text-[10px] text-emerald-400 font-medium">Recommended for Existing Rows</span>
              </div>
            </div>
            <input
              type="radio"
              checked={mode === 'identifier'}
              onChange={() => setMode('identifier')}
              className="accent-emerald-500 w-4 h-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Matches each CSV product to an existing Excel row where the chosen keys match (e.g. <code>CSV Product ID</code> = <code>Excel SKU</code>). Any new products will be appended.
          </p>
        </div>

        {/* Row Order Mode */}
        <div
          onClick={() => setMode('row_order')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            mode === 'row_order'
              ? 'bg-emerald-950/20 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                mode === 'row_order' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              }`}>
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Match by Row Order / Append</h3>
                <span className="text-[10px] text-slate-400 font-medium">Sequential Insertion</span>
              </div>
            </div>
            <input
              type="radio"
              checked={mode === 'row_order'}
              onChange={() => setMode('row_order')}
              className="accent-emerald-500 w-4 h-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Fills Excel rows in exact 1-to-1 sequential order starting after the template header row, or appends all {validCsvRows.length} CSV records to the sheet.
          </p>
        </div>
      </div>

      {/* Identifier Mapping Configuration */}
      {mode === 'identifier' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
            <GitMerge className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Identifier Key Alignment
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
            {/* CSV Key */}
            <div className="md:col-span-5 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>CSV Identifier Column:</span>
              </label>
              <select
                value={csvKey}
                onChange={(e) => setCsvKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm font-medium rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                {csvData.headers.map((h) => (
                  <option key={h} value={h}>
                    CSV: {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Arrow */}
            <div className="md:col-span-1 flex justify-center text-emerald-400 py-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>

            {/* Excel Key */}
            <div className="md:col-span-5 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Excel Target Column:</span>
              </label>
              <select
                value={excelKey}
                onChange={(e) => setExcelKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm font-medium rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                {(excelSheet?.headers || []).map((h, idx) => {
                  const headerName = typeof h === 'string' ? h : h.header;
                  return (
                    <option key={headerName || idx} value={headerName}>
                      Excel: {headerName}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Match Insight Alert */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>
                Matching <strong>{validCsvRows.length} CSV records</strong> against Excel sheet <strong>"{excelSheet.name}"</strong>
              </span>
            </div>
            {excelExistingKeys.size > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-mono font-medium">
                {matchedPreviewCount} Existing Matches Found
              </span>
            )}
          </div>
        </div>
      )}

      {/* Visual Matching Preview Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Table className="w-4 h-4 text-emerald-400" />
            <span>Product Alignment Preview</span>
          </div>
          <span className="text-[11px] text-slate-400">First 5 Sample Rows</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-sans">
                <th className="px-4 py-2.5">#</th>
                <th className="px-4 py-2.5 text-emerald-400">CSV Key: {csvKey}</th>
                <th className="px-4 py-2.5 text-slate-300">Product Name</th>
                <th className="px-4 py-2.5 text-teal-400">Target Excel Column: {excelKey}</th>
                <th className="px-4 py-2.5 text-slate-400">Match Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {previewList.slice(0, 5).map((row, idx) => {
                const idVal = row[csvKey];
                const isExisting = excelExistingKeys.has(String(idVal || '').trim().toLowerCase());
                return (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="px-4 py-2 text-slate-500 font-sans">{idx + 1}</td>
                    <td className="px-4 py-2 text-emerald-300 font-semibold">{idVal || '—'}</td>
                    <td className="px-4 py-2 text-slate-300">{row['Product Name'] || row['title'] || row['Title'] || row['Name'] || '—'}</td>
                    <td className="px-4 py-2 text-teal-300">{idVal || '—'}</td>
                    <td className="px-4 py-2 font-sans">
                      {mode === 'identifier' && isExisting ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px] border border-emerald-500/30">
                          Update Existing Row
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 text-[10px] border border-blue-500/30">
                          Append New Row
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
          <span>Back: Upload Excel</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <span>Step 4: Provide Product URLs</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
