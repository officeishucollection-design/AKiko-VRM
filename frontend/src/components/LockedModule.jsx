import { Lock, ArrowLeft, Clock, ShieldCheck, Sparkles, Video, FileSpreadsheet } from 'lucide-react';

export default function LockedModule({ moduleName, moduleCode, expectedFeatures, onBackToVrm, onBackToLms }) {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 animate-fade-in text-center space-y-8">
      {/* Icon Badge */}
      <div className="flex flex-col items-center">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-xl shadow-amber-500/10">
          <Lock className="w-10 h-10" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
          <Clock className="w-3.5 h-3.5" /> Coming Soon
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          {moduleName} ({moduleCode})
        </h2>
        <p className="text-slate-400 text-sm max-w-lg mt-2 leading-relaxed">
          This system is currently under active development as part of the RunRave OpsSuite ecosystem. It will be unlocked in an upcoming update.
        </p>
      </div>

      {/* Feature Preview Card */}
      <div className="bg-dark-800 border border-white/5 rounded-3xl p-6 md:p-8 text-left space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" />
          Planned Capabilities for {moduleCode}
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {expectedFeatures?.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/60 border border-white/5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span className="text-xs text-slate-300 leading-snug">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Return Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
        <button
          onClick={onBackToVrm}
          className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Video className="w-4 h-4" />
          Return to VRM Stations
        </button>

        {onBackToLms && (
          <button
            onClick={onBackToLms}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-white/10 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
            Open List Management System
          </button>
        )}
      </div>
    </div>
  );
}
