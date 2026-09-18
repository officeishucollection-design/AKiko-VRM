import React, { useState } from 'react';
import {
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Check,
  FileText,
  Code,
  Share2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Job, FieldMapping } from '../../types';
import { api } from '../../services/api';

interface Step9ExportExcelProps {
  job: Job;
  fieldMappings: FieldMapping[];
  excelFilename: string;
  onResetToNewJob: () => void;
  onBack: () => void;
}

export const Step9ExportExcel: React.FC<Step9ExportExcelProps> = ({
  job,
  fieldMappings,
  excelFilename,
  onResetToNewJob,
  onBack,
}) => {
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const blob = await api.exportCatalog(job.id, exportFormat);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = (excelFilename || 'Product_Catalog').replace(/\.[^/.]+$/, '');
      const ext = exportFormat === 'csv' ? 'csv' : 'xlsx';
      a.download = `Enriched_${baseName}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setHasExported(true);

      // Trigger Confetti Celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      console.error('Export error:', e);
      alert(`Failed to export ${exportFormat.toUpperCase()} file. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  const completedCount = job.items.filter(i => i.status === 'Completed').length;
  const partialCount = job.items.filter(i => i.status === 'Partial' || i.status === 'Needs Review').length;
  const totalCellsEnriched = (completedCount + partialCount) * fieldMappings.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Success Hero Card */}
      <div className="bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 mx-auto shadow-xl shadow-emerald-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Ready to Generate & Download
          </h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto">
            Choose your preferred output format to download your completed product catalog.
          </p>
        </div>

        {/* Format Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left pt-2">
          {/* Excel Option */}
          <div
            onClick={() => setExportFormat('xlsx')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
              exportFormat === 'xlsx'
                ? 'bg-emerald-950/30 border-emerald-500 shadow-lg shadow-emerald-500/15'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  exportFormat === 'xlsx' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-emerald-400'
                }`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Excel Workbook
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      .xlsx
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Preserves formulas & styling</p>
                </div>
              </div>
              <input
                type="radio"
                checked={exportFormat === 'xlsx'}
                onChange={() => setExportFormat('xlsx')}
                className="accent-emerald-500 w-4 h-4"
              />
            </div>
          </div>

          {/* CSV Option */}
          <div
            onClick={() => setExportFormat('csv')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
              exportFormat === 'csv'
                ? 'bg-emerald-950/30 border-emerald-500 shadow-lg shadow-emerald-500/15'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  exportFormat === 'csv' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-400'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    CSV Document
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      .csv
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Universal plain text data</p>
                </div>
              </div>
              <input
                type="radio"
                checked={exportFormat === 'csv'}
                onChange={() => setExportFormat('csv')}
                className="accent-emerald-500 w-4 h-4"
              />
            </div>
          </div>
        </div>

        {/* Big Download Button */}
        <div className="pt-2">
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-5 h-5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>
              {isExporting
                ? `Generating ${exportFormat.toUpperCase()} Catalog...`
                : `Download Completed ${exportFormat === 'csv' ? 'CSV (.csv)' : 'Excel (.xlsx)'}`}
            </span>
          </button>
        </div>

        {hasExported && (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 rounded-full text-xs font-semibold">
            <Check className="w-3.5 h-3.5" />
            <span>{exportFormat.toUpperCase()} File Successfully Downloaded!</span>
          </div>
        )}
      </div>

      {/* Preservation & Integrity Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Exact Template Preserved</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All workbook sheets, fonts, borders, column widths, number formats, and existing formulas are 100% retained.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
            <Layers className="w-4 h-4" />
            <span>{job.items.length} Products Processed</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {completedCount} fully completed, {partialCount} partial/reviewed records written to destination cells.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
            <Sparkles className="w-4 h-4" />
            <span>{fieldMappings.length} Fields Enriched</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Estimated {totalCellsEnriched} data cells populated from verified CSV and web extraction pipelines.
          </p>
        </div>
      </div>

      {/* Alternative Export Actions & New Job Reset */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white">Start Another Enrichment Job</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Process a new batch of products or upload a different CSV and template.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            Back to Review Grid
          </button>

          <button
            onClick={onResetToNewJob}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Start New Catalog</span>
          </button>
        </div>
      </div>
    </div>
  );
};
