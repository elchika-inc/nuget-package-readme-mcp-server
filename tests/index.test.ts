import { expect, test, describe } from "vitest";

describe('MCP Server', () => {
  test('should have server module', () => {
    const server = require('../dist/src/server.js');
    expect(typeof server).toBe('object');
  });
});
