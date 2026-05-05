import { describe, it, expect } from 'vitest';
import {
  validateProfile,
  ProfileValidationError,
  createProfile,
  sanitizeProfileName,
} from '@/lib/profileUtils';

const VALID_FIELD = {
  id: 'field-1',
  name: 'sentiment',
  type: 'text' as const,
  description: 'overall sentiment of the row',
};

const VALID_NEW_PROFILE = {
  name: 'My Profile',
  prompt: 'Analyze {company}',
  outputFields: [VALID_FIELD],
  scrapeBackend: 'local' as const,
  enableSearch: true,
  browserVisible: false,
  version: '1.0',
  createdAt: '2026-05-05T10:00:00.000Z',
};

describe('validateProfile — valid input', () => {
  it('accepts a fully-formed new-shape profile', () => {
    const result = validateProfile(VALID_NEW_PROFILE);
    expect(result.name).toBe('My Profile');
    expect(result.prompt).toBe('Analyze {company}');
    expect(result.outputFields).toHaveLength(1);
    expect(result.outputFields[0]).toEqual(VALID_FIELD);
    expect(result.scrapeBackend).toBe('local');
    expect(result.enableSearch).toBe(true);
    expect(result.browserVisible).toBe(false);
    expect(result.version).toBe('1.0');
  });

  it('round-trips through createProfile -> validateProfile', () => {
    const created = createProfile(
      'Round Trip',
      'Hello {x}',
      [VALID_FIELD],
      'firecrawl',
      false,
      true
    );
    expect(() => validateProfile(created)).not.toThrow();
    const validated = validateProfile(created);
    expect(validated.scrapeBackend).toBe('firecrawl');
    expect(validated.browserVisible).toBe(true);
  });
});

describe('validateProfile — legacy migration (load-bearing)', () => {
  it('migrates a pre-v1.1 profile that has only enableSearch (no scrapeBackend) to local', () => {
    const legacy = {
      name: 'Legacy Profile',
      prompt: 'Old prompt',
      outputFields: [VALID_FIELD],
      enableSearch: true,
      // scrapeBackend INTENTIONALLY missing — this is the legacy shape
      version: '1.0',
      createdAt: '2025-09-01T08:00:00.000Z',
    };
    const result = validateProfile(legacy);
    expect(result.scrapeBackend).toBe('local');     // defaulted
    expect(result.enableSearch).toBe(true);          // preserved verbatim
    expect(result.browserVisible).toBe(false);       // defaulted to false
  });

  it('preserves enableSearch=false on a legacy profile', () => {
    const legacy = {
      name: 'No-search Legacy',
      prompt: 'X',
      outputFields: [],
      enableSearch: false,
      version: '1.0',
      createdAt: '2025-09-01T08:00:00.000Z',
    };
    const result = validateProfile(legacy);
    expect(result.enableSearch).toBe(false);
    expect(result.scrapeBackend).toBe('local');
  });

  it('handles a legacy profile with NO enableSearch field at all (defaults to false)', () => {
    const ancient = {
      name: 'Ancient',
      prompt: 'Y',
      outputFields: [],
      version: '0.9',
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const result = validateProfile(ancient);
    expect(result.enableSearch).toBe(false);
    expect(result.scrapeBackend).toBe('local');
    expect(result.browserVisible).toBe(false);
  });

  it('rejects an unknown scrapeBackend value (falls back to local default, does NOT throw)', () => {
    const corrupted = {
      ...VALID_NEW_PROFILE,
      scrapeBackend: 'made-up-backend',
    };
    const result = validateProfile(corrupted);
    expect(result.scrapeBackend).toBe('local');
  });
});

describe('validateProfile — rejection of garbage', () => {
  it('rejects null', () => {
    expect(() => validateProfile(null)).toThrow(ProfileValidationError);
  });

  it('rejects a number', () => {
    expect(() => validateProfile(42)).toThrow(ProfileValidationError);
  });

  it('rejects a missing name', () => {
    const bad = { ...VALID_NEW_PROFILE, name: '' };
    expect(() => validateProfile(bad)).toThrow(/name/i);
  });

  it('rejects a missing prompt', () => {
    const bad = { ...VALID_NEW_PROFILE };
    delete (bad as Partial<typeof bad>).prompt;
    expect(() => validateProfile(bad)).toThrow(/prompt/i);
  });

  it('rejects outputFields that is not an array', () => {
    const bad = { ...VALID_NEW_PROFILE, outputFields: 'not-an-array' };
    expect(() => validateProfile(bad)).toThrow(/outputFields/);
  });

  it('rejects an output field with invalid type', () => {
    const bad = {
      ...VALID_NEW_PROFILE,
      outputFields: [{ ...VALID_FIELD, type: 'invalid-type' }],
    };
    expect(() => validateProfile(bad)).toThrow(/type/i);
  });

  it('rejects an output field missing name', () => {
    const bad = {
      ...VALID_NEW_PROFILE,
      outputFields: [{ ...VALID_FIELD, name: '' }],
    };
    expect(() => validateProfile(bad)).toThrow(/name/i);
  });

  it('rejects a malformed createdAt', () => {
    const bad = { ...VALID_NEW_PROFILE, createdAt: 'not-a-date' };
    expect(() => validateProfile(bad)).toThrow(/createdAt/i);
  });
});

describe('sanitizeProfileName', () => {
  it('returns the trimmed name when non-empty', () => {
    expect(sanitizeProfileName('  Hello World  ')).toBe('Hello World');
  });

  it('returns "Unnamed Profile" for empty / whitespace-only input', () => {
    expect(sanitizeProfileName('')).toBe('Unnamed Profile');
    expect(sanitizeProfileName('   ')).toBe('Unnamed Profile');
  });
});
