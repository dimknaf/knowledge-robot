'use client';

import { Tag, Columns } from 'lucide-react';

interface ColumnTagsProps {
  columns: string[];
  onTagClick: (column: string) => void;
}

export default function ColumnTags({ columns, onTagClick }: ColumnTagsProps) {
  return (
    <div className="card-base-static">
      <div className="flex items-center gap-2 mb-3">
        <span className="step-badge">1</span>
        <Columns size={16} className="text-[var(--foreground-muted)]" strokeWidth={2} />
        <h3 className="text-base font-semibold text-[var(--foreground)] tracking-tight">Column Tags</h3>
        <span className="text-xs text-[var(--foreground-subtle)] hidden sm:inline">— click to insert into prompt</span>
        <span className="ml-auto tabular-nums text-xs font-medium text-[var(--foreground-muted)]">
          {columns.length} {columns.length === 1 ? 'column' : 'columns'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {columns.map((column) => (
          <button
            key={column}
            onClick={() => onTagClick(column)}
            className="
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              bg-[var(--surface-muted)] text-[var(--foreground)]
              border border-[var(--border)]
              hover:bg-[var(--info-bg)] hover:border-[var(--primary)]/40
              active:scale-[0.97] transition-[background-color,border-color,transform] duration-120 cursor-pointer
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]
            "
          >
            <Tag size={11} className="text-[var(--foreground-subtle)]" strokeWidth={1.75} />
            {column}
          </button>
        ))}
      </div>
    </div>
  );
}
