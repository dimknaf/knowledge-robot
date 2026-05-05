'use client';

import { ReactNode } from 'react';
import { OutputField, ProcessedRow } from '@/types';
import { CheckCircle, XCircle, Loader2, Clock, Table, List } from 'lucide-react';

type StatTone = 'default' | 'success' | 'info' | 'danger' | 'muted';

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: StatTone;
}

function StatCard({ label, value, icon, tone = 'default' }: StatCardProps) {
  const toneClass: Record<StatTone, string> = {
    default: 'text-[var(--foreground)]',
    success: 'text-[var(--success)]',
    info:    'text-[var(--primary)]',
    danger:  'text-[var(--danger)]',
    muted:   'text-[var(--foreground-subtle)]',
  };
  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-card)] p-4 transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={toneClass[tone]} aria-hidden="true">{icon}</span>
        <span className="eyebrow">{label}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums tracking-tight leading-none ${toneClass[tone]}`}>
        {value}
      </div>
    </div>
  );
}

interface ResultsTableProps {
  results: ProcessedRow[];
  outputFields: OutputField[];
  includeInput: boolean;
  isProcessing: boolean;
  progress: number;
}

export default function ResultsTable({
  results,
  outputFields,
  includeInput,
  isProcessing,
  progress,
}: ResultsTableProps) {
  if (results.length === 0) {
    return null;
  }

  // Input columns from row data (always available — populated at upload time).
  // Output columns from the schema, NOT from results[0].outputData — otherwise
  // they don't render until row 0 specifically completes, which with concurrency
  // can lag behind other rows that already have data.
  const inputColumns = results[0]?.inputData
    ? Object.keys(results[0].inputData)
    : [];
  const outputColumns = outputFields.map(f => f.name);

  const allColumns = includeInput
    ? [...inputColumns, ...outputColumns]
    : outputColumns;

  const getStatusBadge = (status: ProcessedRow['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="badge badge-emerald">
            <CheckCircle size={12} />
            Done
          </span>
        );
      case 'processing':
        return (
          <span className="badge badge-indigo">
            <Loader2 size={12} className="animate-spin" />
            Processing
          </span>
        );
      case 'error':
        return (
          <span className="badge badge-red">
            <XCircle size={12} />
            Error
          </span>
        );
      case 'pending':
        return (
          <span className="badge badge-slate">
            <Clock size={12} />
            Pending
          </span>
        );
    }
  };

  const getRowClass = (status: ProcessedRow['status']) => {
    switch (status) {
      case 'completed':
        return 'status-row-completed';
      case 'processing':
        return 'status-row-processing';
      case 'error':
        return 'status-row-error';
      case 'pending':
        return 'status-row-pending';
    }
  };

  // Calculate stats
  const completedCount = results.filter(r => r.status === 'completed').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const processingCount = results.filter(r => r.status === 'processing').length;

  const pendingCount = results.length - completedCount - errorCount - processingCount;

  return (
    <div className="space-y-4">
      {/* Stat cards — Stripe-style KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total"
          value={results.length}
          icon={<List size={14} strokeWidth={2} />}
        />
        <StatCard
          label="Completed"
          value={completedCount}
          tone="success"
          icon={<CheckCircle size={14} strokeWidth={2} />}
        />
        <StatCard
          label="In progress"
          value={processingCount + pendingCount}
          tone={processingCount > 0 ? 'info' : 'muted'}
          icon={<Loader2 size={14} strokeWidth={2} className={processingCount > 0 ? 'animate-spin' : ''} />}
        />
        <StatCard
          label="Failed"
          value={errorCount}
          tone={errorCount > 0 ? 'danger' : 'muted'}
          icon={<XCircle size={14} strokeWidth={2} />}
        />
      </div>

      <div className="card-base-static">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="step-badge">4</span>
          <Table size={16} className="text-[var(--foreground-muted)]" strokeWidth={2} />
          <h3 className="text-base font-semibold text-[var(--foreground)] tracking-tight">Processing Results</h3>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-2.5">
            <div className="w-32 h-1.5 bg-[var(--surface-muted)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 animate-progress-stripes"
                style={{ width: `${progress}%`, background: 'var(--gradient-primary)' }}
              />
            </div>
            <span className="text-xs font-medium text-[var(--foreground)] min-w-[2.5rem] tabular-nums text-right">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] custom-scrollbar">
        <table className="min-w-full divide-y divide-[var(--border)]">
          <thead className="bg-[var(--surface-muted)] sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-[0.06em]">
                Status
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-[0.06em] w-12">
                Row
              </th>
              {allColumns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-[10px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-[0.06em]"
                >
                  {col}
                  {outputColumns.includes(col) && (
                    <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success)]/15 normal-case tracking-normal">
                      output
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
            {results.map((row) => (
              <tr
                key={row.rowIndex}
                className={`${getRowClass(row.status)} transition-colors duration-150`}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  {getStatusBadge(row.status)}
                </td>
                <td className="px-3 py-2 text-xs font-medium text-[var(--foreground-muted)] tabular-nums text-right whitespace-nowrap">
                  {row.rowIndex + 1}
                </td>
                {allColumns.map((col) => {
                  const isOutputColumn = outputColumns.includes(col);
                  const value = isOutputColumn
                    ? row.outputData?.[col]
                    : row.inputData[col];

                  return (
                    <td
                      key={`${row.rowIndex}-${col}`}
                      className={`px-3 py-2 text-xs whitespace-nowrap max-w-xs truncate ${
                        isOutputColumn ? 'font-medium text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'
                      }`}
                      title={value !== null && value !== undefined ? String(value) : ''}
                    >
                      {row.status === 'error' && isOutputColumn ? (
                        <span className="text-[var(--danger)] italic text-xs">Failed</span>
                      ) : row.status === 'pending' && isOutputColumn ? (
                        <span className="text-[var(--foreground-subtle)]">—</span>
                      ) : row.status === 'processing' && isOutputColumn ? (
                        <span className="text-[var(--primary)] italic flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-xs">Processing</span>
                        </span>
                      ) : value !== null && value !== undefined ? (
                        String(value)
                      ) : (
                        ''
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
