import { Profile, OutputField, FieldType, ScrapeBackend, DEFAULT_SCRAPE_BACKEND } from '@/types';

const PROFILE_VERSION = '1.0';
const VALID_FIELD_TYPES: FieldType[] = ['text', 'number', 'boolean', 'date'];
const VALID_SCRAPE_BACKENDS: ScrapeBackend[] = ['firecrawl', 'local'];

/**
 * Validation error class for profile operations
 */
export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileValidationError';
  }
}

/**
 * Validates that a value is a valid FieldType
 */
function isValidFieldType(type: unknown): type is FieldType {
  return typeof type === 'string' && VALID_FIELD_TYPES.includes(type as FieldType);
}

/**
 * Validates an OutputField object
 */
function validateOutputField(field: unknown, index: number): OutputField {
  if (typeof field !== 'object' || field === null) {
    throw new ProfileValidationError(`Output field at index ${index} is not an object`);
  }

  const f = field as Record<string, unknown>;

  if (typeof f.id !== 'string') {
    throw new ProfileValidationError(`Output field at index ${index} missing valid 'id' (string)`);
  }

  if (typeof f.name !== 'string' || f.name.trim() === '') {
    throw new ProfileValidationError(`Output field at index ${index} missing valid 'name' (non-empty string)`);
  }

  if (!isValidFieldType(f.type)) {
    throw new ProfileValidationError(
      `Output field at index ${index} has invalid 'type'. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`
    );
  }

  if (typeof f.description !== 'string') {
    throw new ProfileValidationError(`Output field at index ${index} missing valid 'description' (string)`);
  }

  return {
    id: f.id,
    name: f.name,
    type: f.type,
    description: f.description,
  };
}

/**
 * Validates a Profile object loaded from JSON
 *
 * @param data - Unknown data to validate
 * @returns Validated Profile object
 * @throws ProfileValidationError if validation fails
 */
export function validateProfile(data: unknown): Profile {
  // Check if data is an object
  if (typeof data !== 'object' || data === null) {
    throw new ProfileValidationError('Profile data must be an object');
  }

  const profile = data as Record<string, unknown>;

  // Validate required string fields
  if (typeof profile.name !== 'string' || profile.name.trim() === '') {
    throw new ProfileValidationError('Profile must have a valid "name" (non-empty string)');
  }

  if (typeof profile.prompt !== 'string') {
    throw new ProfileValidationError('Profile must have a valid "prompt" (string)');
  }

  if (typeof profile.version !== 'string') {
    throw new ProfileValidationError('Profile must have a valid "version" (string)');
  }

  if (typeof profile.createdAt !== 'string') {
    throw new ProfileValidationError('Profile must have a valid "createdAt" (ISO timestamp string)');
  }

  // Resolve scrapeBackend (defaults to local).
  let scrapeBackend: ScrapeBackend;
  if (typeof profile.scrapeBackend === 'string' && VALID_SCRAPE_BACKENDS.includes(profile.scrapeBackend as ScrapeBackend)) {
    scrapeBackend = profile.scrapeBackend as ScrapeBackend;
  } else {
    // Legacy profile (no scrapeBackend field): default to local. enableSearch handled below.
    scrapeBackend = DEFAULT_SCRAPE_BACKEND;
  }

  // enableSearch: preserved verbatim from new or legacy shape.
  const enableSearch = typeof profile.enableSearch === 'boolean' ? profile.enableSearch : false;

  const browserVisible = typeof profile.browserVisible === 'boolean' ? profile.browserVisible : false;

  // Validate outputFields array
  if (!Array.isArray(profile.outputFields)) {
    throw new ProfileValidationError('Profile must have "outputFields" as an array');
  }

  const outputFields: OutputField[] = [];
  for (let i = 0; i < profile.outputFields.length; i++) {
    outputFields.push(validateOutputField(profile.outputFields[i], i));
  }

  // Validate createdAt is a valid ISO date
  const createdAtDate = new Date(profile.createdAt);
  if (isNaN(createdAtDate.getTime())) {
    throw new ProfileValidationError('Profile "createdAt" must be a valid ISO timestamp');
  }

  return {
    name: profile.name,
    prompt: profile.prompt,
    outputFields,
    scrapeBackend,
    enableSearch,
    browserVisible,
    version: profile.version,
    createdAt: profile.createdAt,
  };
}

export function createProfile(
  name: string,
  prompt: string,
  outputFields: OutputField[],
  scrapeBackend: ScrapeBackend,
  enableSearch: boolean,
  browserVisible: boolean
): Profile {
  return {
    name: name.trim(),
    prompt,
    outputFields,
    scrapeBackend,
    enableSearch,
    browserVisible,
    version: PROFILE_VERSION,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Exports a Profile to a JSON file and triggers download
 *
 * @param profile - Profile to export
 */
export function exportProfile(profile: Profile): void {
  // Create JSON string with pretty formatting
  const jsonString = JSON.stringify(profile, null, 2);

  // Create blob with JSON data
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename from profile name
  const sanitizedName = profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  link.download = `profile_${sanitizedName}_${timestamp}.json`;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Imports a Profile from a File object
 *
 * @param file - File object from file input
 * @returns Promise that resolves to validated Profile
 * @throws ProfileValidationError if validation fails
 */
export async function importProfile(file: File): Promise<Profile> {
  // Check file type
  if (!file.name.endsWith('.json')) {
    throw new ProfileValidationError('Profile file must be a .json file');
  }

  // Read file content
  const text = await file.text();

  // Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ProfileValidationError(
      `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Validate and return
  return validateProfile(data);
}

/**
 * Sanitizes a profile name for display
 */
export function sanitizeProfileName(name: string): string {
  return name.trim() || 'Unnamed Profile';
}
