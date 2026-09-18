import React from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  Layers,
  History,
  Search,
  Download,
  Sun,
  Moon,
} from 'lucide-react';
import { api } from '../../services/api';

interface HeaderProps {
  currentTab: 'dashboard' | 'wizard' | 'jobs' | 'url-tools';
  onSelectTab: (tab: 'dashboard' | 'wizard' | 'jobs' | 'url-tools') => void;
  onLoadSample: () => void;
  isLoadingSample: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onLoadSample,
  isLoadingSample,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & App Name */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => onSelectTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-tight">
                  List Management <span className="text-emerald-400">Excel Filler</span>
                </h1>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                  LMS
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                RunRave OpsSuite &bull; CSV & Web Data Enricher &rarr; Completed Excel Spreadsheet
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden md:inline">Dashboard</span>
            </button>

            <button
              onClick={() => onSelectTab('wizard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'wizard'
                  ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>New Job Wizard</span>
            </button>

            <button
              onClick={() => onSelectTab('jobs')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'jobs'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">Job Runs</span>
            </button>

            <button
              onClick={() => onSelectTab('url-tools')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'url-tools'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden md:inline">URL Inspector</span>
            </button>
          </nav>

          {/* Quick Actions & Mode Change Switch */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLoadSample}
              disabled={isLoadingSample}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-950/20 transition-all cursor-pointer disabled:opacity-50"
              title="Load preloaded smartphone catalog CSV + Excel template with live mock URLs"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLoadingSample ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isLoadingSample ? 'Loading Demo...' : 'Load Sample Demo'}
              </span>
            </button>

            <a
              href={api.getDownloadTemplateUrl()}
              download
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 rounded-lg transition-all"
              title="Download clean sample XLSX template file"
            >
              <Download className="w-3.5 h-3.5" />
              Template
            </a>

            {/* Mode Change Switch (Dark / Light Mode) */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm group"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle light/dark mode"
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-500 group-hover:-rotate-12 transition-transform duration-300" />
                )}
              </div>
              <span className="text-xs font-semibold font-sans">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
