'use client';

import { Play, StopCircle, Settings, Zap } from 'lucide-react';

interface ExecutionControlsProps {
  concurrentRuns: number;
  onConcurrentRunsChange: (value: number) => void;
  includeInput: boolean;
  onIncludeInputChange: (value: boolean) => void;
  isProcessing: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export default function ExecutionControls({
  concurrentRuns,
  onConcurrentRunsChange,
  includeInput,
  onIncludeInputChange,
  isProcessing,
  onStart,
  onStop,
  disabled,
}: ExecutionControlsProps) {
  return (
    <div className="card-base-static">
      <div className="flex items-center gap-2 mb-4">
        <span className="step-badge">3</span>
        <Settings size={16} className="text-[var(--foreground-muted)]" strokeWidth={2} />
        <h3 className="text-base font-semibold text-[var(--foreground)] tracking-tight">Execution Controls</h3>
      </div>

      <div className="space-y-4">
        {/* Concurrent Runs Slider */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--foreground-subtle)]">
              Concurrent Runs
            </label>
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-[var(--foreground-muted)]" strokeWidth={1.75} />
              <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
                {concurrentRuns}
              </span>
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={concurrentRuns}
            onChange={(e) => onConcurrentRunsChange(Number(e.target.value))}
            disabled={disabled || isProcessing}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-[var(--foreground-subtle)] mt-1.5 px-0.5 tabular-nums">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Include Input Checkbox */}
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            id="includeInput"
            checked={includeInput}
            onChange={(e) => onIncludeInputChange(e.target.checked)}
            disabled={disabled || isProcessing}
            className="w-4 h-4 accent-[var(--primary)] border-[var(--border-strong)] rounded-[var(--radius-sm)] focus:ring-[var(--ring)] focus:ring-offset-0 disabled:opacity-50 cursor-pointer"
          />
          <label htmlFor="includeInput" className="text-sm text-[var(--foreground)] cursor-pointer select-none">
            Include input columns in output
          </label>
        </div>

        {/* Action Buttons — primary CTA gets h-11 (only place taller than h-9) */}
        <div className="pt-1">
          {!isProcessing ? (
            <button
              onClick={onStart}
              disabled={disabled}
              className="
                w-full inline-flex items-center justify-center gap-2 h-11 px-4
                bg-[var(--primary)] text-[var(--primary-foreground)]
                rounded-[var(--radius-md)] font-semibold text-sm tracking-tight
                shadow-[var(--shadow-sm)]
                hover:bg-[var(--primary-hover)]
                active:scale-[0.97] transition-[background-color,transform] duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]
                disabled:bg-[var(--foreground-subtle)] disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              <Play size={16} strokeWidth={2} />
              Start Processing
            </button>
          ) : (
            <button
              onClick={onStop}
              className="
                w-full inline-flex items-center justify-center gap-2 h-11 px-4
                bg-[var(--danger)] text-[var(--primary-foreground)]
                rounded-[var(--radius-md)] font-semibold text-sm tracking-tight
                shadow-[var(--shadow-sm)]
                hover:brightness-95
                active:scale-[0.97] transition-[filter,transform] duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]
              "
            >
              <StopCircle size={16} strokeWidth={2} />
              Stop Processing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
