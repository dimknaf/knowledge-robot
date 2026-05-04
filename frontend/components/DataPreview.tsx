'use client';

import { CsvRow } from '@/types';
import { Table, FileSpreadsheet } from 'lucide-react';

interface DataPreviewProps {
  headers: string[];
  rows: CsvRow[];
}

export default function DataPreview({ headers, rows }: DataPreviewProps) {
  return (
    <div className="card-base-static">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50">
          <FileSpreadsheet size={18} className="text-slate-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Data Preview</h3>
          <p className="text-xs text-slate-500">
            {rows.length} row{rows.length !== 1 ? 's' : ''} · {headers.length} column{headers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-slate-200 custom-scrollbar">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">
                #
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-indigo-50/30 transition-colors duration-150"
              >
                <td className="px-4 py-2.5 text-xs font-medium text-slate-400 whitespace-nowrap">
                  {rowIndex + 1}
                </td>
                {headers.map((header) => (
                  <td
                    key={`${rowIndex}-${header}`}
                    className="px-4 py-2.5 text-sm text-slate-700 whitespace-nowrap max-w-xs truncate"
                    title={row[header] !== null && row[header] !== undefined ? String(row[header]) : ''}
                  >
                    {row[header] !== null && row[header] !== undefined
                      ? String(row[header])
                      : <span className="text-slate-300">—</span>}
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
