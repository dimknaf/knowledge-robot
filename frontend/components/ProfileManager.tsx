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
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50">
          <Package size={18} className="text-slate-600" />
        </div>
        <h3 className="font-semibold text-slate-800">Profile Manager</h3>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700 animate-fadeIn">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700 animate-fadeIn">
          <CheckCircle size={16} className="flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Current Profile Display */}
      {currentProfileName && (
        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">
              {sanitizeProfileName(currentProfileName)}
            </span>
          </div>
          <button
            onClick={onProfileClear}
            disabled={disabled}
            className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
            title="Clear profile"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
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
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-slideUp">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50">
                <Save size={20} className="text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Save Profile</h3>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
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
