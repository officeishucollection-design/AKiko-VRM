import React, { useState, useEffect, useRef } from 'react';
import {
  PlayCircle,
  PauseCircle,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Clock,
  ArrowRight,
  ArrowLeft,
  Terminal,
  Activity,
  Zap,
  Globe,
  Sliders,
} from 'lucide-react';
import { Job, JobProgress, JobLog } from '../../types';
import { api } from '../../services/api';

interface Step7ProcessAllProps {
  job: Job | null;
  onJobUpdated: (job: Job) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step7ProcessAll: React.FC<Step7ProcessAllProps> = ({
  job,
  onJobUpdated,
  onNext,
  onBack,
}) => {
  const [isStarting, setIsStarting] = useState(false);
  const [logs, setLogs] = useState<JobLog[]>(job?.logs || []);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Connect to SSE stream
  useEffect(() => {
    if (!job?.id) return;

    const eventSource = new EventSource(`/api/jobs/${job.id}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          // Fetch full job data
          api.getJob(job.id).then(updated => onJobUpdated(updated));
        } else if (data.type === 'log') {
          setLogs(prev => [...prev.slice(-200), data.log]);
        } else if (data.type === 'itemUpdated') {
          api.getJob(job.id).then(updated => onJobUpdated(updated));
        }
      } catch (e) {
        // SSE parse error ignored
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [job?.id]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!job) {
    return (
      <div className="p-8 text-center text-slate-400">
        Job not created yet. Please complete previous steps.
      </div>
    );
  }

  const { progress, state, currentProduct } = job;
  const isRunning = state === 'running';
  const isPaused = state === 'paused';
  const isCompleted = state === 'completed';

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await api.startJob(job.id);
      const updated = await api.getJob(job.id);
      onJobUpdated(updated);
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async () => {
    await api.pauseJob(job.id);
    const updated = await api.getJob(job.id);
    onJobUpdated(updated);
  };

  const handleResume = async () => {
    await api.resumeJob(job.id);
    const updated = await api.getJob(job.id);
    onJobUpdated(updated);
  };

  const handleCancel = async () => {
    if (window.confirm('Cancel current processing job?')) {
      await api.cancelJob(job.id);
      const updated = await api.getJob(job.id);
      onJobUpdated(updated);
    }
  };

  const handleRetryFailed = async () => {
    await api.retryFailed(job.id);
    const updated = await api.getJob(job.id);
    onJobUpdated(updated);
  };

  const hasAnyUrls = job.items.some(i => i.url && i.url.trim() !== '');
  const urlCount = job.items.filter(i => i.url && i.url.trim() !== '').length;

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              7
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {hasAnyUrls ? 'Batch Web & CSV Processing Hub' : 'Batch CSV Processing Hub'}
            </h2>
            {!hasAnyUrls && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
                CSV-Only Mode
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {hasAnyUrls
              ? `Processing ${job.items.length} products (${urlCount} with live webpage URLs, ${job.items.length - urlCount} using CSV data).`
              : `Processing ${job.items.length} products from CSV dataset mapping directly into Excel template.`}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {state === 'idle' && (
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{isStarting ? 'Starting...' : 'Start Full Job'}</span>
            </button>
          )}

          {isRunning && (
            <>
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <PauseCircle className="w-4 h-4" />
                <span>Pause</span>
              </button>

              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Resume</span>
              </button>

              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </>
          )}

          {(isCompleted || state === 'cancelled') && (
            <button
              onClick={handleRetryFailed}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Failed & Partial</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress & Metric Dashboard Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-2xl font-black text-white">
                {progress.percentage}%
              </span>
              <span className="text-xs text-slate-400 font-sans">
                ({progress.completed + progress.partial + progress.failed} / {progress.total} Products Processed)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[10px] ${
                isRunning
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse'
                  : isCompleted
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : isPaused
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {state}
              </span>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
            <div
              className="bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${(progress.completed / Math.max(1, progress.total)) * 100}%` }}
              title={`Completed: ${progress.completed}`}
            />
            <div
              className="bg-amber-500 transition-all duration-500 ease-out"
              style={{ width: `${(progress.partial / Math.max(1, progress.total)) * 100}%` }}
              title={`Partial: ${progress.partial}`}
            />
            <div
              className="bg-rose-500 transition-all duration-500 ease-out"
              style={{ width: `${(progress.failed / Math.max(1, progress.total)) * 100}%` }}
              title={`Failed: ${progress.failed}`}
            />
          </div>
        </div>

        {/* 4 Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Completed */}
          <div className="bg-slate-950/60 border border-emerald-900/40 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Completed</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                {progress.completed}
              </span>
            </div>
          </div>

          {/* Partial */}
          <div className="bg-slate-950/60 border border-amber-900/40 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Partial / Review</span>
              <span className="text-xl font-bold font-mono text-amber-400">
                {progress.partial}
              </span>
            </div>
          </div>

          {/* Failed */}
          <div className="bg-slate-950/60 border border-rose-900/40 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XOctagon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Failed</span>
              <span className="text-xl font-bold font-mono text-rose-400">
                {progress.failed}
              </span>
            </div>
          </div>

          {/* Remaining */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Remaining</span>
              <span className="text-xl font-bold font-mono text-slate-300">
                {progress.pending + progress.urlMissing}
              </span>
            </div>
          </div>
        </div>

        {/* Currently Active Product Ticker */}
        {isRunning && currentProduct && (
          <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl flex items-center gap-3 text-xs animate-pulse">
            <Activity className="w-4 h-4 text-blue-400 animate-spin" />
            <div className="truncate">
              <span className="text-slate-400">Currently Fetching: </span>
              <span className="font-bold text-white font-mono">{currentProduct.id}</span>
              <span className="text-blue-300 ml-2">({currentProduct.name})</span>
              <span className="text-slate-500 ml-2 font-mono truncate">{currentProduct.url}</span>
            </div>
          </div>
        )}
      </div>

      {/* Live Stream Terminal Logs */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Live Web Extraction Console</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {logs.length} events logged
          </span>
        </div>

        <div className="p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1 bg-black/60">
          {logs.length > 0 ? (
            logs.map((log, idx) => {
              let color = 'text-slate-400';
              if (log.level === 'success') color = 'text-emerald-400';
              else if (log.level === 'warn') color = 'text-amber-400';
              else if (log.level === 'error') color = 'text-rose-400';

              return (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 select-none text-[10px]">[{log.timestamp}]</span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })
          ) : (
            <div className="text-slate-600 italic">No activity yet. Click "Start Full Job" to begin processing.</div>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white font-medium text-xs rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Extraction Preview</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <span>Step 8: Review & Resolve Conflicts</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
