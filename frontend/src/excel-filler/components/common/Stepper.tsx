import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  GitMerge,
  Link,
  TableProperties,
  Eye,
  PlayCircle,
  CheckSquare,
  Download,
  Check,
} from 'lucide-react';

export interface StepItem {
  id: number;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const WIZARD_STEPS: StepItem[] = [
  { id: 1, label: 'Upload CSV', shortLabel: '1. CSV', icon: FileText },
  { id: 2, label: 'Upload Excel', shortLabel: '2. Excel', icon: FileSpreadsheet },
  { id: 3, label: 'Match Products', shortLabel: '3. Match', icon: GitMerge },
  { id: 4, label: 'Add URLs', shortLabel: '4. URLs', icon: Link },
  { id: 5, label: 'Map Fields', shortLabel: '5. Fields', icon: TableProperties },
  { id: 6, label: 'Preview Test', shortLabel: '6. Preview', icon: Eye },
  { id: 7, label: 'Process All', shortLabel: '7. Process', icon: PlayCircle },
  { id: 8, label: 'Review & Edit', shortLabel: '8. Review', icon: CheckSquare },
  { id: 9, label: 'Populate Excel', shortLabel: '9. Export', icon: Download },
];

interface StepperProps {
  currentStep: number;
  maxStepReached: number;
  onStepClick: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  maxStepReached,
  onStepClick,
}) => {
  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 mb-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between overflow-x-auto pb-2 sm:pb-0 gap-2 sm:gap-0 no-scrollbar">
        {WIZARD_STEPS.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isAccessible = step.id <= maxStepReached;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              {/* Step Node */}
              <button
                onClick={() => isAccessible && onStepClick(step.id)}
                disabled={!isAccessible}
                className={`flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left flex-shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-sm'
                    : isCompleted
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    : isAccessible
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    : 'text-slate-600 opacity-60 cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Icon className="w-3.5 h-3.5" />}
                </div>

                <div className="hidden md:block">
                  <div className={`text-xs font-semibold ${isCurrent ? 'text-emerald-300' : 'text-slate-200'}`}>
                    {step.label}
                  </div>
                  <div className="text-[10px] text-slate-400">Step {step.id}</div>
                </div>

                <span className="text-[10px] font-medium sm:hidden block">
                  {step.shortLabel}
                </span>
              </button>

              {/* Connecting Line */}
              {idx < WIZARD_STEPS.length - 1 && (
                <div className="hidden lg:block flex-1 h-[2px] mx-2 bg-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      step.id < currentStep ? 'bg-emerald-500/60' : 'bg-transparent'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
