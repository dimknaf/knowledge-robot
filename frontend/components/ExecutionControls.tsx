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
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50">
          <Settings size={18} className="text-slate-600" />
        </div>
        <h3 className="font-semibold text-slate-800">Execution Controls</h3>
      </div>

      <div className="space-y-5">
        {/* Concurrent Runs Slider */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">
              Concurrent Runs
            </label>
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
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
          <div className="flex justify-between text-xs text-slate-400 mt-2 px-0.5">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Include Input Checkbox */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/60">
          <input
            type="checkbox"
            id="includeInput"
            checked={includeInput}
            onChange={(e) => onIncludeInputChange(e.target.checked)}
            disabled={disabled || isProcessing}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-offset-0 disabled:opacity-50 cursor-pointer"
          />
          <label htmlFor="includeInput" className="text-sm text-slate-700 cursor-pointer select-none">
            Include input columns in output
          </label>
        </div>

        {/* Action Buttons */}
        <div className="pt-2">
          {!isProcessing ? (
            <button
              onClick={onStart}
              disabled={disabled}
              className="
                w-full flex items-center justify-center gap-2.5 px-6 py-3.5
                bg-gradient-to-r from-emerald-500 to-emerald-600 text-white
                rounded-xl font-semibold text-base
                shadow-lg shadow-emerald-500/25
                hover:from-emerald-600 hover:to-emerald-700 hover:shadow-xl hover:shadow-emerald-500/30
                active:scale-[0.98] transition-all duration-150
                disabled:from-slate-400 disabled:to-slate-500 disabled:shadow-none disabled:cursor-not-allowed
              "
            >
              <Play size={20} />
              Start Processing
            </button>
          ) : (
            <button
              onClick={onStop}
              className="
                w-full flex items-center justify-center gap-2.5 px-6 py-3.5
                bg-gradient-to-r from-red-500 to-red-600 text-white
                rounded-xl font-semibold text-base
                shadow-lg shadow-red-500/25
                hover:from-red-600 hover:to-red-700 hover:shadow-xl hover:shadow-red-500/30
                active:scale-[0.98] transition-all duration-150
                animate-pulse
              "
            >
              <StopCircle size={20} />
              Stop Processing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
