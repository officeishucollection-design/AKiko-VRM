import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Table,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  ShieldCheck,
  Calculator,
} from 'lucide-react';
import { ExcelInfo, ExcelSheetInfo } from '../../types';
import { api } from '../../services/api';

interface Step2ExcelUploadProps {
  excelInfo: ExcelInfo | null;
  excelFilename: string;
  templateId: string;
  selectedSheet: string;
  onExcelLoaded: (info: ExcelInfo, filename: string, templateId: string, sheetName: string) => void;
  onSelectSheet: (sheetName: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step2ExcelUpload: React.FC<Step2ExcelUploadProps> = ({
  excelInfo,
  excelFilename,
  templateId,
  selectedSheet,
  onExcelLoaded,
  onSelectSheet,
  onNext,
  onBack,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isAllowed = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv') || lower.endsWith('.txt');
    if (!isAllowed) {
      setError('Please upload a valid Excel workbook (.xlsx/.xls) or CSV template (.csv)');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.uploadExcel(file);
      const defaultSheetName = res.data.defaultSheet || res.data.sheets[0]?.name || 'Sheet1';
      onExcelLoaded(res.data, res.filename, res.templateId, defaultSheetName);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to inspect template file');
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

  const currentSheetInfo: ExcelSheetInfo | undefined = excelInfo?.sheets.find(
    (s) => s.name === selectedSheet
  ) || excelInfo?.sheets[0];

  const [showAllRows, setShowAllRows] = useState(false);
  const allRows = currentSheetInfo?.existingRows || currentSheetInfo?.previewRows || (currentSheetInfo as any)?.sampleRows || [];
  const totalRowCount = allRows.length > 0 ? allRows.length : (currentSheetInfo ? (currentSheetInfo.rowCount > 1 ? currentSheetInfo.rowCount - 1 : 0) : 0);
  const displayedRows = showAllRows ? allRows : allRows.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              2
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Upload Destination Template (Excel or CSV)
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Upload the master spreadsheet or template that will be enriched and populated with your product data.
          </p>
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
            : excelInfo
            ? 'border-slate-700 bg-slate-900/40 hover:border-emerald-500/60'
            : 'border-slate-800 bg-slate-900/20 hover:border-slate-700 hover:bg-slate-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
            <FileSpreadsheet className={`w-7 h-7 ${isLoading ? 'animate-pulse' : ''}`} />
          </div>

          <div>
            <p className="text-base font-semibold text-slate-200">
              {isLoading ? 'Inspecting template structure...' : excelInfo ? 'Replace Template File' : 'Drop your Excel (.xlsx) or CSV template here, or browse'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports Excel (.xlsx, .xls) and CSV templates. Preserves all existing styles, formulas, and headers.
            </p>
          </div>

          {excelInfo && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-950/60 border border-teal-600/40 text-teal-300 rounded-full text-xs font-mono">
              <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
              <span>Workbook: {excelFilename} ({excelInfo.sheetCount} Sheet{excelInfo.sheetCount > 1 ? 's' : ''}, {totalRowCount} rows)</span>
            </div>
          )}
        </div>
      </div>

      {/* Structure Confirmation & Sheet Inspector */}
      {excelInfo && currentSheetInfo && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Sheet Selector & Metadata Badges */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 flex-shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Target Worksheet
                  </h3>
                  <p className="text-xs text-slate-400">
                    Choose the worksheet in this workbook to populate.
                  </p>
                </div>
              </div>

              {/* Sheet selector tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {excelInfo.sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    type="button"
                    onClick={() => onSelectSheet(sheet.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      sheet.name === selectedSheet
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-semibold">{sheet.name}</span>
                    <span className="ml-1.5 text-[10px] text-slate-500">
                      ({sheet.headers.length} cols)
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Integrity Badges */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Original Structure Preserved</span>
              </div>
              <div className="flex items-center gap-1.5 text-teal-300 font-medium">
                <Table className="w-4 h-4 text-teal-400" />
                <span>{totalRowCount} Existing Rows Detected</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                <span>{currentSheetInfo.headers.length} Columns Detected</span>
              </div>
              {currentSheetInfo.hasFormulas && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Calculator className="w-4 h-4" />
                  <span>Formulas Safeguarded</span>
                </div>
              )}
            </div>
          </div>

          {/* Excel Template Columns Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                <span>Template Preview: "{currentSheetInfo.name}"</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">
                  Showing {displayedRows.length} of {totalRowCount} rows (Header Row #{currentSheetInfo.headerRowIndex})
                </span>
                {totalRowCount > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRows(!showAllRows)}
                    className="px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 text-[11px] font-semibold border border-teal-500/30 transition-all cursor-pointer"
                  >
                    {showAllRows ? 'Show First 10' : `Show All ${totalRowCount} Rows`}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="px-4 py-2.5 font-semibold text-slate-500 w-12">#</th>
                    {(currentSheetInfo.headers || []).map((h, i) => {
                      const headerName = typeof h === 'string' ? h : h.header;
                      const colIndex = typeof h === 'string' ? i + 1 : h.colIndex;
                      const address = typeof h === 'string' ? '' : h.address;
                      return (
                        <th
                          key={colIndex || i}
                          className="px-4 py-2.5 font-semibold text-slate-200"
                        >
                          <div className="flex flex-col">
                            <span>{headerName}</span>
                            {address && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Cell {address}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {displayedRows.length > 0 ? (
                    displayedRows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2 text-slate-500 font-sans">{idx + 1}</td>
                        {(currentSheetInfo.headers || []).map((h, i) => {
                          const headerName = typeof h === 'string' ? h : h.header;
                          const colKey = typeof h === 'string' ? i : h.colIndex;
                          return (
                            <td key={colKey || i} className="px-4 py-2 text-slate-300">
                              {row[headerName] !== undefined && row[headerName] !== '' ? (
                                String(row[headerName])
                              ) : (
                                <span className="text-slate-600 italic">empty</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={(currentSheetInfo.headers || []).length + 1}
                        className="px-4 py-6 text-center text-slate-500 italic font-sans"
                      >
                        Template has headers with no pre-existing rows (new rows will be appended).
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
              <span>Back: CSV Upload</span>
            </button>

            <button
              onClick={onNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <span>Step 3: Match Products to Spreadsheet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
