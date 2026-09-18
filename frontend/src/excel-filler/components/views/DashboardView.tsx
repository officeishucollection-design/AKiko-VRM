import React from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  FileText,
  Link,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Database,
  CheckCircle2,
  Cpu,
  Layers,
  Search,
} from 'lucide-react';
import { api } from '../../services/api';

interface DashboardViewProps {
  onStartNewJob: () => void;
  onLoadSample: () => void;
  isLoadingSample: boolean;
  onOpenUrlTools: () => void;
  onOpenJobsHistory: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onStartNewJob,
  onLoadSample,
  isLoadingSample,
  onOpenUrlTools,
  onOpenJobsHistory,
}) => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-3xl p-8 sm:p-10 overflow-hidden shadow-2xl">
        {/* Glow effect */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-semibold text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI & Structured Web Product Extractor</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Automate Excel Spreadsheet Enrichment with CSV & Web Data
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Combine partial CSV product info, manually provided product webpage URLs, and multi-tier web extraction (JSON-LD, OpenGraph, DOM heuristics) to generate a fully populated, formula-preserving Excel spreadsheet.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onStartNewJob}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-xl shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <span>Launch 9-Step Wizard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onLoadSample}
              disabled={isLoadingSample}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-emerald-400 ${isLoadingSample ? 'animate-spin' : ''}`} />
              <span>{isLoadingSample ? 'Loading Demo...' : 'Load Sample Smartphone Demo'}</span>
            </button>

            <button
              onClick={onOpenUrlTools}
              className="flex items-center gap-2 px-4 py-3 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>URL Inspector</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Step Workflow Visual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Step 1 Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">1. CSV + Excel Template</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Upload your base product CSV (with SKU/Name/Category) and your target Excel template. Preserves all formulas, fonts, and styles.
          </p>
        </div>

        {/* Step 2 Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Link className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">2. URL Assignment (Optional)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Optionally assign webpage URLs for live product web extraction (inline, bulk paste, or CSV map), or skip this step to populate using CSV records only.
          </p>
        </div>

        {/* Step 3 Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">3. Multi-Tier Web Extraction</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Background workers extract JSON-LD, OpenGraph, and specs tables. Review, resolve conflicts, and export populated XLSX.
          </p>
        </div>
      </div>

      {/* Preloaded Demo Presets & Templates */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Instant One-Click Demo Project</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Test the entire 9-step automated pipeline in 30 seconds with pre-built sample files.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={api.getDownloadCsvUrl()}
              download
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Download Sample CSV
            </a>
            <a
              href={api.getDownloadTemplateUrl()}
              download
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 transition-all flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Download Sample Template
            </a>
          </div>
        </div>

        {/* Demo Details Box */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Smartphones & Flagship Devices Catalog</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                Ready to Run
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Includes 7 products (iPhone 15, Galaxy S24 Ultra, Pixel 9 Pro, MacBook Air M3, etc.) with pre-mapped price, MRP, weight, and specs.
            </p>
          </div>

          <button
            onClick={onLoadSample}
            disabled={isLoadingSample}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isLoadingSample ? 'animate-spin' : ''}`} />
            <span>{isLoadingSample ? 'Loading Demo Project...' : 'Load & Test Demo'}</span>
          </button>
        </div>
      </div>

      {/* Key Architectural Guarantees */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>SSRF Protected</span>
          </div>
          <p className="text-slate-400">
            Blocks private IP subnets, loopbacks, and cloud metadata to guarantee security.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-teal-400 font-bold">
            <Cpu className="w-4 h-4" />
            <span>Multi-Tier Extractor</span>
          </div>
          <p className="text-slate-400">
            Extracts JSON-LD, OpenGraph, Microdata, CSS selectors, and regex heuristics with confidence scoring.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-blue-400 font-bold">
            <Database className="w-4 h-4" />
            <span>Formula Safeguard</span>
          </div>
          <p className="text-slate-400">
            Uses ExcelJS to protect existing worksheet formulas, merged cells, fonts, and styles.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-purple-400 font-bold">
            <Layers className="w-4 h-4" />
            <span>Conflict Resolution</span>
          </div>
          <p className="text-slate-400">
            Flags discrepancies between CSV and webpage data for seamless 1-click resolution.
          </p>
        </div>
      </div>
    </div>
  );
};
