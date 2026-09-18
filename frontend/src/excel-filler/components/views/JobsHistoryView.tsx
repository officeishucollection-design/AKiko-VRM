import React, { useState, useEffect } from 'react';
import {
  History,
  Play,
  RotateCcw,
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../services/api';
import { Job } from '../../types';

interface JobsHistoryViewProps {
  onSelectJob: (jobId: string) => void;
  onStartNewJob: () => void;
}

export const JobsHistoryView: React.FC<JobsHistoryViewProps> = ({
  onSelectJob,
  onStartNewJob,
}) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAllJobs();
      setJobs(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Batch Enrichment Job History
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            View status, progress, and download exports from previously executed batches.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchJobs}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
            title="Refresh job list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onStartNewJob}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <span>+ New Job</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading jobs...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <History className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Previous Jobs Found</h3>
            <p className="text-xs text-slate-400">
              Start your first enrichment job to populate Excel files with CSV & web data.
            </p>
          </div>
          <button
            onClick={onStartNewJob}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
          >
            Start Enrichment Job
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => onSelectJob(job.id)}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    Job #{job.id.substring(0, 8)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    job.state === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : job.state === 'running'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {job.state}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span>{job.itemCount} Products</span>
                  <span>•</span>
                  <span>Created: {new Date(job.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right font-mono text-xs hidden sm:block">
                  <span className="text-slate-300 font-bold">
                    {job.progress?.completed || 0} / {job.progress?.total || 0} Enriched
                  </span>
                  <span className="text-slate-500 block text-[10px]">
                    {job.progress?.percentage || 0}% Complete
                  </span>
                </div>

                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
