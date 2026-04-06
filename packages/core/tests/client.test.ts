import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TipStreamClient, TipStreamError, TimeoutError, NetworkError } from '../src/index.js';

describe('TipStreamClient', () => {
  const mockFetch = vi.fn();
  
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should throw if apiKey is not provided', () => {
      expect(() => new TipStreamClient({ apiKey: '' })).toThrow('API key is required');
    });

    it('should create client with valid config', () => {
      const client = new TipStreamClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should use default baseUrl', () => {
      const client = new TipStreamClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });
  });

  describe('request', () => {
    it('should make GET request with correct headers', async () => {
      const client = new TipStreamClient({ apiKey: 'test-key' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ data: 'test' }),
      });

      const response = await client.get('/test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        })
      );
      
      expect(response.data).toEqual({ data: 'test' });
    });

    it('should make POST request with body', async () => {
      const client = new TipStreamClient({ apiKey: 'test-key' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map(),
        json: () => Promise.resolve({ id: 1 }),
      });

      const response = await client.post('/users', { name: 'John' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'John' }),
        })
      );
      
      expect(response.data).toEqual({ id: 1 });
    });

    it('should handle API errors', async () => {
      const client = new TipStreamClient({ apiKey: 'test-key' });
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: () => Promise.resolve({ message: 'Invalid input', code: 'INVALID_INPUT' }),
      });

      await expect(client.get('/test')).rejects.toThrow(TipStreamError);
      
      try {
        await client.get('/test');
      } catch (error) {
        if (error instanceof TipStreamError) {
          expect(error.status).toBe(400);
          expect(error.code).toBe('INVALID_INPUT');
        }
      }
    });

    it('should retry on server errors', async () => {
      const client = new TipStreamClient({ 
        apiKey: 'test-key',
        retries: 2,
        retryDelay: 10,
      });
      
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Map(),
          json: () => Promise.resolve({ message: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map(),
          json: () => Promise.resolve({ data: 'success' }),
        });

      const response = await client.get('/test');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.data).toEqual({ data: 'success' });
    });

    it('should not retry on client errors', async () => {
      const client = new TipStreamClient({ 
        apiKey: 'test-key',
        retries: 3,
      });
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        json: () => Promise.resolve({ message: 'Not found' }),
      });

      await expect(client.get('/test')).rejects.toThrow();
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout', async () => {
      const client = new TipStreamClient({ 
        apiKey: 'test-key',
        timeout: 100,
      });
      
      mockFetch.mockImplementation(() => new Promise((_, reject) => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 50);
      }));

      await expect(client.get('/test')).rejects.toThrow(TimeoutError);
    });
  });

  describe('events', () => {
    it('should emit request:start event', async () => {
      const client = new TipStreamClient({ apiKey: 'test-key' });
      const listener = vi.fn();
      
      client.on('request:start', listener);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({}),
      });

      await client.get('/test');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/test',
          method: 'GET',
        })
      );
    });

    it('should emit request:end event with duration', async () => {
      const client = new TipStreamClient({ apiKey: 'test-key' });
      const listener = vi.fn();
      
      client.on('request:end', listener);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({}),
      });

      await client.get('/test');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/test',
          method: 'GET',
          status: 200,
          duration: expect.any(Number),
        })
      );
    });

    it('should allow unsubscribing from events', async () => {
      const client = new TipStreamClient({ apiKey: 'test-key' });
      const listener = vi.fn();
      
      const unsubscribe = client.on('request:start', listener);
      unsubscribe();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({}),
      });

      await client.get('/test');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    let client: TipStreamClient;

    beforeEach(() => {
      client = new TipStreamClient({ apiKey: 'test-key' });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({}),
      });
    });

    it('should call PUT method', async () => {
      await client.put('/test', { data: 'test' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should call PATCH method', async () => {
      await client.patch('/test', { data: 'test' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should call DELETE method', async () => {
      await client.delete('/test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});

describe('Error classes', () => {
  it('TipStreamError should be retryable for 5xx', () => {
    const error = new TipStreamError('Server error', 500);
    expect(error.isRetryable).toBe(true);
  });

  it('TipStreamError should be retryable for 429', () => {
    const error = new TipStreamError('Rate limited', 429);
    expect(error.isRetryable).toBe(true);
  });

  it('TipStreamError should not be retryable for 4xx', () => {
    const error = new TipStreamError('Not found', 404);
    expect(error.isRetryable).toBe(false);
  });

  it('TimeoutError should have correct status', () => {
    const error = new TimeoutError(5000);
    expect(error.status).toBe(408);
    expect(error.code).toBe('TIMEOUT');
  });

  it('NetworkError should have zero status', () => {
    const error = new NetworkError('Connection failed');
    expect(error.status).toBe(0);
    expect(error.code).toBe('NETWORK_ERROR');
  });
});
