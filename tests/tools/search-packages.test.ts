import { expect, test, describe } from "vitest";

describe('search-packages tool', () => {
  test('should validate required parameters', async () => {
    const { searchPackages } = require('../../dist/src/tools/search-packages.js');
    
    try {
      await searchPackages({});
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      // Accept various forms of "required" validation messages
      expect(error.message).toMatch(/(required|must be|cannot be empty|is required|invalid.*format|invalid.*query)/i);
    }
  });

  test('should validate parameter types', async () => {
    const { searchPackages } = require('../../dist/src/tools/search-packages.js');
    
    try {
      await searchPackages({ query: 123 });
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      // Accept various forms of type validation messages
      expect(error.message).toMatch(/(string|must be|type|invalid.*format|invalid.*query)/i);
    }
  });

  test('should have correct function signature', () => {
    const { searchPackages } = require('../../dist/src/tools/search-packages.js');
    expect(typeof searchPackages).toBe('function');
  });

  test('should validate empty query', async () => {
    const { searchPackages } = require('../../dist/src/tools/search-packages.js');
    
    try {
      await searchPackages({ query: '' });
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      // Accept various forms of empty validation messages
      expect(error.message).toMatch(/(required|cannot be empty|must be|is required|invalid.*format|invalid.*query)/i);
    }
  });
});
