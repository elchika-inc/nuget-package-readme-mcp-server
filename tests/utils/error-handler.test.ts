import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleApiError, handleHttpError, withRetry } from '../../src/utils/error-handler.js';
import {
  PackageReadmeMcpError,
  PackageNotFoundError,
  RateLimitError,
  NetworkError,
} from '../../src/types/index.js';

describe('Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('should re-throw PackageReadmeMcpError instances', () => {
      const originalError = new PackageReadmeMcpError('Test error', 'TEST_CODE');
      
      expect(() => handleApiError(originalError, 'test context')).toThrow(PackageReadmeMcpError);
      expect(() => handleApiError(originalError, 'test context')).toThrow('Test error');
    });

    it('should convert ENOTFOUND errors to NetworkError', () => {
      const error = new Error('getaddrinfo ENOTFOUND example.com');
      
      expect(() => handleApiError(error, 'DNS lookup')).toThrow(NetworkError);
      expect(() => handleApiError(error, 'DNS lookup')).toThrow('Connection failed in DNS lookup');
    });

    it('should convert ECONNREFUSED errors to NetworkError', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:80');
      
      expect(() => handleApiError(error, 'connection test')).toThrow(NetworkError);
      expect(() => handleApiError(error, 'connection test')).toThrow('Connection failed in connection test');
    });

    it('should convert timeout errors to NetworkError', () => {
      const error = new Error('Request timeout');
      
      expect(() => handleApiError(error, 'API call')).toThrow(NetworkError);
      expect(() => handleApiError(error, 'API call')).toThrow('Request timeout in API call');
    });

    it('should wrap unexpected Error instances', () => {
      const error = new Error('Some unexpected error');
      
      expect(() => handleApiError(error, 'operation')).toThrow(PackageReadmeMcpError);
      expect(() => handleApiError(error, 'operation')).toThrow('Unexpected error in operation');
    });

    it('should wrap unknown errors', () => {
      const error = 'string error';
      
      expect(() => handleApiError(error, 'operation')).toThrow(PackageReadmeMcpError);
      expect(() => handleApiError(error, 'operation')).toThrow('Unknown error in operation');
    });
  });

  describe('handleHttpError', () => {
    const createMockResponse = (status: number, statusText: string = '', headers: Record<string, string> = {}) => {
      return {
        status,
        statusText,
        headers: {
          get: (name: string) => headers[name.toLowerCase()] || null,
        },
      } as Response;
    };

    it('should throw PackageNotFoundError for 404 status', () => {
      const response = createMockResponse(404, 'Not Found');
      
      expect(() => handleHttpError(404, response, 'package lookup')).toThrow(PackageNotFoundError);
    });

    it('should throw RateLimitError for 429 status', () => {
      const response = createMockResponse(429, 'Too Many Requests');
      
      expect(() => handleHttpError(429, response, 'API request')).toThrow(RateLimitError);
    });

    it('should throw RateLimitError with retry-after header', () => {
      const response = createMockResponse(429, 'Too Many Requests', { 'retry-after': '60' });
      
      try {
        handleHttpError(429, response, 'API request');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).details).toEqual({ retryAfter: 60 });
      }
    });

    it('should throw NetworkError for server errors (5xx)', () => {
      const testCases = [500, 502, 503, 504];
      
      for (const status of testCases) {
        const response = createMockResponse(status, 'Server Error');
        
        expect(() => handleHttpError(status, response, 'server call')).toThrow(NetworkError);
        expect(() => handleHttpError(status, response, 'server call')).toThrow(`Server error (${status}): Server Error`);
      }
    });

    it('should throw PackageReadmeMcpError for other HTTP errors', () => {
      const response = createMockResponse(403, 'Forbidden');
      
      try {
        handleHttpError(403, response, 'API access');
      } catch (error) {
        expect(error).toBeInstanceOf(PackageReadmeMcpError);
        expect((error as PackageReadmeMcpError).message).toBe('HTTP error 403: Forbidden');
        expect((error as PackageReadmeMcpError).statusCode).toBe(403);
      }
    });

    it('should handle empty statusText', () => {
      const response = createMockResponse(418, '');
      
      expect(() => handleHttpError(418, response, 'teapot')).toThrow('HTTP error 418: Unknown error');
    });
  });

  describe('withRetry', () => {

    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn, 3, 1000, 'test operation');
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on NetworkError', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new NetworkError('Connection failed'))
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, 3, 10, 'test operation'); // 短い遅延
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on RateLimitError with custom delay', async () => {
      const rateLimitError = new RateLimitError('Rate limited', 0.01); // 10ms
      const fn = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, 3, 10, 'test operation');
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on server errors (5xx)', async () => {
      const serverError = new PackageReadmeMcpError('Server error', 'SERVER_ERROR', 500);
      const fn = vi.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, 3, 10, 'test operation');
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on PackageNotFoundError', async () => {
      const notFoundError = new PackageNotFoundError('Package not found');
      const fn = vi.fn().mockRejectedValue(notFoundError);
      
      await expect(withRetry(fn, 3, 1000, 'test operation')).rejects.toThrow(PackageNotFoundError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const networkError = new NetworkError('Persistent failure');
      const fn = vi.fn().mockRejectedValue(networkError);
      
      await expect(withRetry(fn, 2, 10, 'test operation')).rejects.toThrow(NetworkError);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const networkError = new NetworkError('Temporary failure');
      const fn = vi.fn().mockRejectedValue(networkError);
      
      await expect(withRetry(fn, 2, 10, 'test operation')).rejects.toThrow(NetworkError);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle non-Error rejections', async () => {
      const fn = vi.fn().mockRejectedValue('string error');
      
      await expect(withRetry(fn, 1, 1000, 'test operation')).rejects.toThrow('string error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw error when all retries fail without capturing an error', async () => {
      // この状況は理論的には起こりえないが、防御的プログラミングのため
      const fn = vi.fn().mockImplementation(() => {
        throw undefined;
      });
      
      await expect(withRetry(fn, 1, 10, 'test operation')).rejects.toThrow();
    });

    it('should handle RateLimitError without retryAfter', async () => {
      const rateLimitError = new RateLimitError('Rate limited');
      const fn = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, 3, 10, 'test operation');
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});