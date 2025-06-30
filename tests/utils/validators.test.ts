import { describe, it, expect } from 'vitest';
import {
  validatePackageName,
  validateVersion,
  validateSearchQuery,
  validateLimit,
  validateScore,
} from '../../src/utils/validators.js';
import { PackageReadmeMcpError } from '../../src/types/index.js';

describe('Validators', () => {
  describe('validatePackageName', () => {
    it('should accept valid package names', () => {
      const validNames = [
        'Newtonsoft.Json',
        'Microsoft.Extensions.Logging',
        'System.Text.Json',
        'My_Package',
        'Package-Name',
        'Package123',
        'A',
        'a1',
        '1Package',
      ];

      for (const name of validNames) {
        expect(() => validatePackageName(name)).not.toThrow();
      }
    });

    it('should reject invalid package names', () => {
      const invalidCases = [
        { name: '', expectedError: 'Package name is required and must be a string' },
        { name: '   ', expectedError: 'Package name cannot be empty' },
        { name: '.InvalidStart', expectedError: 'Package name contains invalid characters' },
        { name: 'Invalid..Double', expectedError: 'Package name cannot contain consecutive periods' },
        { name: 'InvalidEnd.', expectedError: 'Package name cannot contain consecutive periods' },
        { name: 'Invalid Space', expectedError: 'Package name contains invalid characters' },
        { name: 'Invalid@Symbol', expectedError: 'Package name contains invalid characters' },
        { name: 'Invalid/Slash', expectedError: 'Package name contains invalid characters' },
        { name: 'A'.repeat(101), expectedError: 'Package name cannot exceed 100 characters' },
      ];

      for (const { name, expectedError } of invalidCases) {
        expect(() => validatePackageName(name)).toThrow(PackageReadmeMcpError);
        expect(() => validatePackageName(name)).toThrow(expectedError);
      }
    });

    it('should reject non-string inputs', () => {
      const invalidInputs = [null, undefined, 123, [], {}];

      for (const input of invalidInputs) {
        expect(() => validatePackageName(input as any)).toThrow(PackageReadmeMcpError);
        expect(() => validatePackageName(input as any)).toThrow('Package name is required and must be a string');
      }
    });
  });

  describe('validateVersion', () => {
    it('should accept valid semantic versions', () => {
      const validVersions = [
        '1.0.0',
        '1.2.3',
        '10.20.30',
        '1.0.0.0',
        '1.2.3.4',
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-alpha.beta',
        '1.0.0+build.1',
        '1.0.0-alpha+build.1',
        '2.0.0-rc.1',
        '1.0.0-beta.11',
      ];

      for (const version of validVersions) {
        expect(() => validateVersion(version)).not.toThrow();
      }
    });

    it('should accept special version tags', () => {
      const specialTags = ['latest', 'prerelease'];

      for (const tag of specialTags) {
        expect(() => validateVersion(tag)).not.toThrow();
      }
    });

    it('should reject invalid versions', () => {
      const invalidCases = [
        { version: '', expectedError: 'Version must be a string' },
        { version: '   ', expectedError: 'Version cannot be empty' },
        { version: 'invalid', expectedError: 'Version must be a valid semantic version' },
        { version: '1', expectedError: 'Version must be a valid semantic version' },
        { version: '1.2', expectedError: 'Version must be a valid semantic version' },
        { version: '1.2.3.4.5', expectedError: 'Version must be a valid semantic version' },
        { version: '01.0.0', expectedError: 'Version must be a valid semantic version' },
        { version: '1.02.0', expectedError: 'Version must be a valid semantic version' },
        { version: '1.0.03', expectedError: 'Version must be a valid semantic version' },
        { version: '1.0.0-', expectedError: 'Version must be a valid semantic version' },
        { version: '1.0.0+', expectedError: 'Version must be a valid semantic version' },
        { version: 'v1.0.0', expectedError: 'Version must be a valid semantic version' },
      ];

      for (const { version, expectedError } of invalidCases) {
        expect(() => validateVersion(version)).toThrow(PackageReadmeMcpError);
        expect(() => validateVersion(version)).toThrow(expectedError);
      }
    });

    it('should reject non-string inputs', () => {
      const invalidInputs = [null, undefined, 123, [], {}];

      for (const input of invalidInputs) {
        expect(() => validateVersion(input as any)).toThrow(PackageReadmeMcpError);
        expect(() => validateVersion(input as any)).toThrow('Version must be a string');
      }
    });
  });

  describe('validateSearchQuery', () => {
    it('should accept valid search queries', () => {
      const validQueries = [
        'json',
        'Microsoft.Extensions',
        'logging framework',
        'test package',
        'A'.repeat(250), // Max length
      ];

      for (const query of validQueries) {
        expect(() => validateSearchQuery(query)).not.toThrow();
      }
    });

    it('should reject invalid search queries', () => {
      const invalidCases = [
        { query: '', expectedError: 'Search query is required and must be a string' },
        { query: '   ', expectedError: 'Search query cannot be empty' },
        { query: 'A'.repeat(251), expectedError: 'Search query cannot exceed 250 characters' },
      ];

      for (const { query, expectedError } of invalidCases) {
        expect(() => validateSearchQuery(query)).toThrow(PackageReadmeMcpError);
        expect(() => validateSearchQuery(query)).toThrow(expectedError);
      }
    });

    it('should reject non-string inputs', () => {
      const invalidInputs = [null, undefined, 123, [], {}];

      for (const input of invalidInputs) {
        expect(() => validateSearchQuery(input as any)).toThrow(PackageReadmeMcpError);
        expect(() => validateSearchQuery(input as any)).toThrow('Search query is required and must be a string');
      }
    });
  });

  describe('validateLimit', () => {
    it('should accept valid limits', () => {
      const validLimits = [1, 10, 20, 50, 100, 250];

      for (const limit of validLimits) {
        expect(() => validateLimit(limit)).not.toThrow();
      }
    });

    it('should reject invalid limits', () => {
      const invalidCases = [
        { limit: 0, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: -1, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: 251, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: 1000, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: 1.5, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: '10' as any, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: null as any, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: undefined as any, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: NaN, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: Infinity, expectedError: 'Limit must be an integer between 1 and 250' },
        { limit: -Infinity, expectedError: 'Limit must be an integer between 1 and 250' },
      ];

      for (const { limit, expectedError } of invalidCases) {
        expect(() => validateLimit(limit)).toThrow(PackageReadmeMcpError);
        expect(() => validateLimit(limit)).toThrow(expectedError);
      }
    });
  });

  describe('validateScore', () => {
    it('should accept valid scores', () => {
      const validScores = [0, 0.1, 0.5, 0.9, 1.0];

      for (const score of validScores) {
        expect(() => validateScore(score, 'quality')).not.toThrow();
        expect(() => validateScore(score, 'popularity')).not.toThrow();
      }
    });

    it('should reject invalid scores', () => {
      const invalidCases = [
        { score: -0.1, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: 1.1, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: -1, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: 2, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: '0.5' as any, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: null as any, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: undefined as any, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: NaN, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: Infinity, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
        { score: -Infinity, name: 'quality', expectedError: 'quality must be a number between 0 and 1' },
      ];

      for (const { score, name, expectedError } of invalidCases) {
        expect(() => validateScore(score, name)).toThrow(PackageReadmeMcpError);
        expect(() => validateScore(score, name)).toThrow(expectedError);
      }
    });

    it('should use provided parameter name in error message', () => {
      expect(() => validateScore(-1, 'popularity')).toThrow('popularity must be a number between 0 and 1');
      expect(() => validateScore(2, 'quality')).toThrow('quality must be a number between 0 and 1');
      expect(() => validateScore(1.5, 'maintenance')).toThrow('maintenance must be a number between 0 and 1');
    });
  });
});