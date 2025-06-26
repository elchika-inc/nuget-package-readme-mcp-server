import { expect, test, describe } from "vitest";

describe('get-package-info tool', () => {
  test('should validate required parameters', async () => {
    const { getPackageInfo } = require('../../dist/src/tools/get-package-info.js');
    
    try {
      await getPackageInfo({});
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      // Accept various forms of "required" validation messages
      expect(error.message).toMatch(/(required|must be|cannot be empty|is required|invalid.*format|invalid.*query)/i);
    }
  });

  test('should validate parameter types', async () => {
    const { getPackageInfo } = require('../../dist/src/tools/get-package-info.js');
    
    try {
      await getPackageInfo({ package_name: 123 });
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      // Accept various forms of type validation messages
      expect(error.message).toMatch(/(string|must be|type|invalid.*format|invalid.*query)/i);
    }
  });

  test('should have correct function signature', () => {
    const { getPackageInfo } = require('../../dist/src/tools/get-package-info.js');
    expect(typeof getPackageInfo).toBe('function');
  });

  test('should validate empty package name', async () => {
    const { getPackageInfo } = require('../../dist/src/tools/get-package-info.js');
    
    try {
      await getPackageInfo({ package_name: '' });
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      // Accept various forms of empty validation messages
      expect(error.message).toMatch(/(required|cannot be empty|must be|is required|invalid.*format|invalid.*query)/i);
    }
  });
});
