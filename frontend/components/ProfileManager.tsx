'use client';

import { useState, useRef } from 'react';
import { Save, FolderOpen, X, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { Profile, OutputField, ScrapeBackend } from '@/types';
import {
  createProfile,
  exportProfile,
  importProfile,
  ProfileValidationError,
  sanitizeProfileName
} from '@/lib/profileUtils';

interface ProfileManagerProps {
  prompt: string;
  outputFields: OutputField[];
  scrapeBackend: ScrapeBackend;
  enableSearch: boolean;
  browserVisible: boolean;
  currentProfileName: string | null;
  onProfileLoad: (profile: Profile) => void;
  onProfileClear: () => void;
  disabled?: boolean;
}

export default function ProfileManager({
  prompt,
  outputFields,
  scrapeBackend,
  enableSearch,
  browserVisible,
  currentProfileName,
  onProfileLoad,
  onProfileClear,
  disabled,
}: ProfileManagerProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear messages after 3 seconds
  const showMessage = (type: 'error' | 'success', message: string) => {
    if (type === 'error') {
      setError(message);
      setTimeout(() => setError(null), 5000);
    } else {
      setSuccess(message);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  // Handle save profile
  const handleSave = () => {
    if (!profileName.trim()) {
      showMessage('error', 'Please enter a profile name');
      return;
    }

    try {
      const profile = createProfile(
        profileName,
        prompt,
        outputFields,
        scrapeBackend,
        enableSearch,
        browserVisible
      );
      exportProfile(profile);
      setShowSaveDialog(false);
      setProfileName('');
      showMessage('success', `Profile "${profile.name}" saved successfully`);
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to save profile');
    }
  };

  // Handle load profile
  const handleLoad = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const profile = await importProfile(file);
      onProfileLoad(profile);
      showMessage('success', `Profile "${profile.name}" loaded successfully`);
    } catch (err) {
      if (err instanceof ProfileValidationError) {
        showMessage('error', `Invalid profile: ${err.message}`);
      } else {
        showMessage('error', err instanceof Error ? err.message : 'Failed to load profile');
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card-base-static">
      <div className="flex items-center gap-2 mb-3">
        <Package size={16} className="text-[var(--foreground-muted)]" strokeWidth={2} />
        <h3 className="text-base font-semibold text-[var(--foreground)] tracking-tight">Profile Manager</h3>
        <span className="ml-auto eyebrow">Optional</span>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[var(--radius)] flex items-center gap-2 text-xs text-[var(--danger)] animate-fadeIn">
          <AlertCircle size={14} strokeWidth={1.75} className="flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 px-3 py-2 bg-[var(--success-bg)] border border-[var(--success)]/20 rounded-[var(--radius)] flex items-center gap-2 text-xs text-[var(--success)] animate-fadeIn">
          <CheckCircle size={14} strokeWidth={1.75} className="flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Current Profile Display */}
      {currentProfileName && (
        <div className="mb-3 px-2.5 py-1.5 bg-[var(--info-bg)] border border-[var(--primary)]/15 rounded-[var(--radius)] flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Package size={12} className="text-[var(--primary)] flex-shrink-0" strokeWidth={1.75} />
            <span className="text-xs font-medium text-[var(--foreground)] truncate">
              {sanitizeProfileName(currentProfileName)}
            </span>
          </div>
          <button
            onClick={onProfileClear}
            disabled={disabled}
            className="p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded-[var(--radius-sm)] transition-colors disabled:opacity-50 flex-shrink-0"
            title="Clear profile"
          >
            <X size={12} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowSaveDialog(true)}
          disabled={disabled || !prompt || outputFields.length === 0}
          className="btn-primary flex items-center justify-center gap-2 text-sm"
        >
          <Save size={16} />
          Save Profile
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoad}
          disabled={disabled}
          className="hidden"
          id="profile-file-input"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="btn-secondary flex items-center justify-center gap-2 text-sm"
        >
          <FolderOpen size={16} />
          Load Profile
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 glass-dark flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-[var(--radius-xl)] p-5 max-w-md w-full shadow-[var(--shadow-pop)] border border-[var(--border)] animate-slideUp">
            <div className="flex items-center gap-2 mb-4">
              <Save size={14} className="text-[var(--foreground-muted)]" strokeWidth={1.75} />
              <h3 className="text-base font-semibold text-[var(--foreground)] tracking-tight">Save Profile</h3>
            </div>
            <div className="mb-4">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--foreground-subtle)] mb-1.5">
                Profile Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setShowSaveDialog(false);
                }}
                placeholder="e.g., Sentiment Analysis v1"
                className="input-base"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setProfileName('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
