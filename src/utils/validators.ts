import { PackageReadmeMcpError } from '../types/index.js';

const MAX_PACKAGE_NAME_LENGTH = 100;
const MAX_SEARCH_QUERY_LENGTH = 250;
const MIN_LIMIT = 1;
const MAX_LIMIT = 250;
const MIN_SCORE = 0;
const MAX_SCORE = 1;

export function validatePackageName(packageName: string): void {
  if (!packageName || typeof packageName !== 'string') {
    throw new PackageReadmeMcpError('Package name is required and must be a string', 'INVALID_PACKAGE_NAME');
  }

  const trimmed = packageName.trim();
  if (trimmed.length === 0) {
    throw new PackageReadmeMcpError('Package name cannot be empty', 'INVALID_PACKAGE_NAME');
  }

  if (trimmed.length > MAX_PACKAGE_NAME_LENGTH) {
    throw new PackageReadmeMcpError(`Package name cannot exceed ${MAX_PACKAGE_NAME_LENGTH} characters`, 'INVALID_PACKAGE_NAME');
  }

  // NuGet package name validation rules
  // Must not start with a dot, can contain letters, numbers, periods, hyphens, and underscores
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
    throw new PackageReadmeMcpError(
      'Package name contains invalid characters. Must start with a letter or number and can contain letters, numbers, periods, hyphens, and underscores',
      'INVALID_PACKAGE_NAME'
    );
  }

  // Check for invalid sequences
  if (trimmed.includes('..') || trimmed.endsWith('.')) {
    throw new PackageReadmeMcpError('Package name cannot contain consecutive periods or end with a period', 'INVALID_PACKAGE_NAME');
  }
}

export function validateVersion(version: string): void {
  if (!version || typeof version !== 'string') {
    throw new PackageReadmeMcpError('Version must be a string', 'INVALID_VERSION');
  }

  const trimmed = version.trim();
  if (trimmed.length === 0) {
    throw new PackageReadmeMcpError('Version cannot be empty', 'INVALID_VERSION');
  }

  // Allow "latest" and other common tags
  if (trimmed === 'latest' || trimmed === 'prerelease') {
    return;
  }

  // Validate semantic version (NuGet supports 4-part versions)
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  if (!semverRegex.test(trimmed)) {
    throw new PackageReadmeMcpError(
      'Version must be a valid semantic version (e.g., 1.0.0 or 1.0.0.0) or a tag (e.g., latest)',
      'INVALID_VERSION'
    );
  }
}

export function validateSearchQuery(query: string): void {
  if (!query || typeof query !== 'string') {
    throw new PackageReadmeMcpError('Search query is required and must be a string', 'INVALID_SEARCH_QUERY');
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new PackageReadmeMcpError('Search query cannot be empty', 'INVALID_SEARCH_QUERY');
  }

  if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new PackageReadmeMcpError(`Search query cannot exceed ${MAX_SEARCH_QUERY_LENGTH} characters`, 'INVALID_SEARCH_QUERY');
  }
}

export function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
    throw new PackageReadmeMcpError(`Limit must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}`, 'INVALID_LIMIT');
  }
}

export function validateScore(score: number, name: string): void {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < MIN_SCORE || score > MAX_SCORE) {
    throw new PackageReadmeMcpError(`${name} must be a number between ${MIN_SCORE} and ${MAX_SCORE}`, 'INVALID_SCORE');
  }
}