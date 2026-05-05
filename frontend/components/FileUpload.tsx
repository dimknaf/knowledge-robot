'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { parseCSV } from '@/lib/csvParser';
import { CsvData } from '@/types';

interface FileUploadProps {
  onFileUpload: (data: CsvData) => void;
  disabled?: boolean;
}

export default function FileUpload({ onFileUpload, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Upload CSV file: click anywhere in this area or drag a file here"
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      className={`
        relative rounded-[var(--radius-xl)] border border-dashed p-10 md:p-12 text-center
        bg-[var(--surface)] shadow-[var(--shadow-card)]
        transition-[border-color,background-color,box-shadow] duration-200 ease-out
        ${isDragging
          ? 'border-[var(--primary)] bg-[var(--info-bg)] shadow-[var(--shadow-card-hover)]'
          : 'border-[var(--border-strong)] hover:border-[var(--primary)] hover:shadow-[var(--shadow-card-hover)]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none
      `}
      style={{
        backgroundImage: !isDragging
          ? 'radial-gradient(circle at 50% 0%, rgba(99, 91, 255, 0.05) 0%, transparent 60%)'
          : undefined,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="relative pointer-events-none">
        {/* Icon zone — 64px circle with subtle gradient */}
        <div
          className={`
            mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center
            border transition-[transform,background,border-color] duration-200
            ${isDragging
              ? 'border-[var(--primary)]/40 scale-105'
              : 'border-[var(--border)]'
            }
          `}
          style={{
            background: isDragging
              ? 'linear-gradient(135deg, rgba(99, 91, 255, 0.18), rgba(0, 212, 255, 0.10))'
              : 'linear-gradient(135deg, rgba(99, 91, 255, 0.10), rgba(99, 91, 255, 0.02))',
          }}
        >
          {isDragging ? (
            <FileSpreadsheet className="text-[var(--primary)]" size={24} strokeWidth={2} />
          ) : (
            <Upload className="text-[var(--primary)]" size={24} strokeWidth={2} />
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-base font-medium text-[var(--foreground)]">
            {isDragging ? (
              <span className="text-[var(--primary)] font-semibold">Drop your file here</span>
            ) : (
              <>
                <span className="text-[var(--primary)] font-semibold">
                  Click to upload
                </span>
                <span className="text-[var(--foreground-muted)]"> or drag and drop</span>
              </>
            )}
          </p>
          <p className="text-xs text-[var(--foreground-subtle)]">
            CSV files only · up to 10 MB
          </p>
        </div>

        {/* Workflow step trail */}
        <div className="mt-7 flex items-center justify-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
          <span className="flex items-center gap-1.5 text-[var(--primary)]">
            <span className="step-badge !w-4 !h-4 !text-[9px]">1</span>
            Upload
          </span>
          <span className="text-[var(--border-strong)]" aria-hidden="true">·</span>
          <span className="flex items-center gap-1.5 text-[var(--foreground-subtle)]">
            <span className="step-badge-muted !w-4 !h-4 !text-[9px]">2</span>
            Configure
          </span>
          <span className="text-[var(--border-strong)]" aria-hidden="true">·</span>
          <span className="flex items-center gap-1.5 text-[var(--foreground-subtle)]">
            <span className="step-badge-muted !w-4 !h-4 !text-[9px]">3</span>
            Run
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
