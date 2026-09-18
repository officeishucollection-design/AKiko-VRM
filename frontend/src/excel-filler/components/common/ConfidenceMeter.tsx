import React from 'react';

interface ConfidenceMeterProps {
  score: number; // 0 to 1 or 0 to 100
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  score,
  showLabel = true,
  size = 'md',
}) => {
  const percent = score <= 1 ? Math.round(score * 100) : Math.round(score);

  let color = 'bg-rose-500';
  let textColor = 'text-rose-400';
  if (percent >= 85) {
    color = 'bg-emerald-500';
    textColor = 'text-emerald-400';
  } else if (percent >= 65) {
    color = 'bg-amber-500';
    textColor = 'text-amber-400';
  }

  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className="flex items-center gap-2">
      <div className={`w-16 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 ${heightClass}`}>
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-mono font-semibold ${textColor}`}>
          {percent}%
        </span>
      )}
    </div>
  );
};
