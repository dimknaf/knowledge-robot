'use client';

import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { parseCSV } from '@/lib/csvParser';
import { CsvData } from '@/types';

interface FileUploadProps {
  onFileUpload: (data: CsvData) => void;
  disabled?: boolean;
}

export default function FileUpload({ onFileUpload, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const data = await parseCSV(file);
        onFileUpload(data);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please ensure it is a valid CSV.');
      }
    },
    [onFileUpload]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;

      try {
        const data = await parseCSV(file);
        onFileUpload(data);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please ensure it is a valid CSV.');
      }
    },
    [onFileUpload]
  );

  return (
    <div
      className={`
        relative rounded-2xl border-2 border-dashed p-12 text-center
        transition-all duration-300 ease-out
        bg-gradient-to-br from-slate-50 to-white
        ${isDragging
          ? 'border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-500/10 scale-[1.01]'
          : 'border-slate-300 hover:border-indigo-400 hover:shadow-lg hover:shadow-slate-200/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Decorative background element */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

      <div className="relative">
        <div className={`
          mx-auto mb-6 w-20 h-20 rounded-2xl flex items-center justify-center
          bg-gradient-to-br from-indigo-100 to-indigo-50
          transition-all duration-300
          ${isDragging ? 'scale-110' : 'group-hover:scale-105'}
        `}>
          {isDragging ? (
            <FileSpreadsheet className="text-indigo-600" size={36} />
          ) : (
            <Upload className="text-indigo-500" size={36} />
          )}
        </div>

        <label className={`cursor-pointer ${disabled ? 'pointer-events-none' : ''}`}>
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-700">
              {isDragging ? (
                <span className="text-indigo-600">Drop your file here</span>
              ) : (
                <>
                  <span className="text-indigo-600 hover:text-indigo-700 transition-colors">
                    Click to upload
                  </span>
                  <span className="text-slate-600"> or drag and drop</span>
                </>
              )}
            </p>
            <p className="text-sm text-slate-500">
              CSV files only (up to 10MB)
            </p>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
        </label>

        {/* File format badge */}
        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
          <FileSpreadsheet size={14} />
          .csv
        </div>
      </div>
    </div>
  );
}
