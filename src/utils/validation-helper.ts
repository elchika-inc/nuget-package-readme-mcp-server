import { PackageReadmeMcpError } from '../types/index.js';

export function validateArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object') {
    throw new PackageReadmeMcpError('Tool arguments must be an object', 'VALIDATION_ERROR');
  }
  return args as Record<string, unknown>;
}

export function validateRequiredString(value: unknown, fieldName: string): string {
  if (!value || typeof value !== 'string') {
    throw new PackageReadmeMcpError(`${fieldName} is required and must be a string`, 'VALIDATION_ERROR');
  }
  return value;
}

export function validateOptionalString(value: unknown, defaultValue: string): string {
  return typeof value === 'string' ? value : defaultValue;
}

export function validateOptionalBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue;
}

export function validateOptionalNumber(value: unknown, min: number, max: number, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  
  if (typeof value !== 'number' || value < min || value > max) {
    throw new PackageReadmeMcpError(`${fieldName} must be a number between ${min} and ${max}`, 'VALIDATION_ERROR');
  }
  
  return value;
}