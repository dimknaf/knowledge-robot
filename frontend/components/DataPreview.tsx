'use client';

import { CsvRow } from '@/types';
import { FileSpreadsheet } from 'lucide-react';

interface DataPreviewProps {
  headers: string[];
  rows: CsvRow[];
}

export default function DataPreview({ headers, rows }: DataPreviewProps) {
  return (
    <div className="card-base-static">
      <div className="flex items-center gap-2 mb-3">
        <span className="step-badge">1</span>
        <FileSpreadsheet size={16} className="text-[var(--foreground-muted)]" strokeWidth={2} />
        <h3 className="text-base font-semibold text-[var(--foreground)] tracking-tight">Data Preview</h3>
        <span className="ml-auto tabular-nums text-xs text-[var(--foreground-muted)]">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'} · {headers.length} {headers.length === 1 ? 'column' : 'columns'}
        </span>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] custom-scrollbar">
        <table className="min-w-full divide-y divide-[var(--border)]">
          <thead className="bg-[var(--surface-muted)] sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-[0.06em] w-10">
                #
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-[10px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-[0.06em]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-[var(--surface-muted)]/60 transition-colors duration-150"
              >
                <td className="px-3 py-2 text-xs font-medium text-[var(--foreground-subtle)] tabular-nums text-right whitespace-nowrap">
                  {rowIndex + 1}
                </td>
                {headers.map((header) => (
                  <td
                    key={`${rowIndex}-${header}`}
                    className="px-3 py-2 text-xs text-[var(--foreground)] whitespace-nowrap max-w-xs truncate"
                    title={row[header] !== null && row[header] !== undefined ? String(row[header]) : ''}
                  >
                    {row[header] !== null && row[header] !== undefined
                      ? String(row[header])
                      : <span className="text-[var(--foreground-subtle)]">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
