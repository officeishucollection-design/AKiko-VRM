import React from 'react';
import { ProductStatus } from '../../types';

interface StatusBadgeProps {
  status: ProductStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium';

  switch (status) {
    case 'Completed':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Completed
        </span>
      );
    case 'Partial':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Partial
        </span>
      );
    case 'Needs Review':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
          Needs Review
        </span>
      );
    case 'Failed':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          Failed
        </span>
      );
    case 'Processing':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
          Processing
        </span>
      );
    case 'URL Missing':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-slate-700/50 text-slate-400 border border-slate-600/40 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
          Missing URL
        </span>
      );
    case 'URL Invalid':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-rose-900/30 text-rose-400 border border-rose-700/40 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Invalid URL
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          {status || 'Pending'}
        </span>
      );
  }
};

interface MethodBadgeProps {
  method: string | null;
}

export const MethodBadge: React.FC<MethodBadgeProps> = ({ method }) => {
  if (!method) return null;

  let color = 'bg-slate-800 text-slate-300 border-slate-700';
  if (method.includes('JSON-LD')) {
    color = 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40';
  } else if (method.includes('OpenGraph')) {
    color = 'bg-blue-950/60 text-blue-300 border-blue-600/40';
  } else if (method.includes('Microdata')) {
    color = 'bg-cyan-950/60 text-cyan-300 border-cyan-600/40';
  } else if (method.includes('Selector')) {
    color = 'bg-amber-950/60 text-amber-300 border-amber-600/40';
  } else if (method.includes('CSV')) {
    color = 'bg-indigo-950/60 text-indigo-300 border-indigo-600/40';
  } else if (method.includes('Manual')) {
    color = 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-600/40';
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${color}`}>
      {method}
    </span>
  );
};
