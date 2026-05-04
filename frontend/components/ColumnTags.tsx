'use client';

import { Tag, Columns } from 'lucide-react';

interface ColumnTagsProps {
  columns: string[];
  onTagClick: (column: string) => void;
}

// Indigo-based gradient color palette
const colors = [
  'from-indigo-100 to-indigo-50 text-indigo-700 border-indigo-200/50 hover:from-indigo-200 hover:to-indigo-100',
  'from-violet-100 to-violet-50 text-violet-700 border-violet-200/50 hover:from-violet-200 hover:to-violet-100',
  'from-blue-100 to-blue-50 text-blue-700 border-blue-200/50 hover:from-blue-200 hover:to-blue-100',
  'from-cyan-100 to-cyan-50 text-cyan-700 border-cyan-200/50 hover:from-cyan-200 hover:to-cyan-100',
  'from-teal-100 to-teal-50 text-teal-700 border-teal-200/50 hover:from-teal-200 hover:to-teal-100',
  'from-emerald-100 to-emerald-50 text-emerald-700 border-emerald-200/50 hover:from-emerald-200 hover:to-emerald-100',
  'from-purple-100 to-purple-50 text-purple-700 border-purple-200/50 hover:from-purple-200 hover:to-purple-100',
  'from-fuchsia-100 to-fuchsia-50 text-fuchsia-700 border-fuchsia-200/50 hover:from-fuchsia-200 hover:to-fuchsia-100',
];

export default function ColumnTags({ columns, onTagClick }: ColumnTagsProps) {
  return (
    <div className="card-base-static">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-50">
          <Columns size={18} className="text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Column Tags</h3>
          <p className="text-xs text-slate-500">Click to insert into prompt</p>
        </div>
        <span className="ml-auto text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {columns.length} columns
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {columns.map((column, index) => (
          <button
            key={column}
            onClick={() => onTagClick(column)}
            className={`
              inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium
              bg-gradient-to-r border
              shadow-sm hover:shadow-md hover:-translate-y-0.5
              active:scale-95 transition-all duration-150 cursor-pointer
              ${colors[index % colors.length]}
            `}
          >
            <Tag size={12} />
            {column}
          </button>
        ))}
      </div>
    </div>
  );
}
