import type {
  TipStreamClientConfig,
  RequestOptions,
  ApiResponse,
  HttpMethod,
  ClientEvents,
  EventListener,
  RequestSigner,
  ApiErrorResponse,
} from './types.js';
import { TipStreamError, TimeoutError, NetworkError } from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  baseUrl: 'https://api.tipstream.example.com',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
} as const;

/**
 * TipStreamClient - Main SDK client for interacting with TipStream API
 *
 * @example
 * ```typescript
 * const client = new TipStreamClient({
 *   apiKey: process.env.TIPSTREAM_API_KEY,
 * });
 *
 * const response = await client.get('/users');
 * ```
 */
export class TipStreamClient {
  private readonly config: Required<
    Pick<TipStreamClientConfig, 'apiKey' | 'baseUrl' | 'timeout' | 'retries' | 'retryDelay'>
  > &
    TipStreamClientConfig;

  private readonly listeners: Map<keyof ClientEvents, Set<EventListener<unknown>>> = new Map();
  private requestSigner?: RequestSigner;

  constructor(config: TipStreamClientConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Set a request signer for signing outgoing requests
   * (Integration with @tipstream/sdk-security)
   */
  public setSigner(signer: RequestSigner): void {
    this.requestSigner = signer;
  }

  /**
   * Subscribe to client events
   */
  public on<K extends keyof ClientEvents>(
    event: K,
    listener: EventListener<ClientEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener<unknown>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener as EventListener<unknown>);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit<K extends keyof ClientEvents>(event: K, data: ClientEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data);
        } catch (err) {
          if (this.config.debug) {
            console.error(`Error in event listener for ${event}:`, err);
          }
        }
      }
    }
  }

  /**
   * Make an API request
   *
   * @param path - API endpoint path
   * @param options - Request options
   * @returns Promise resolving to API response
   */
  public async request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const method = options.method ?? 'GET';
    const startTime = Date.now();

    this.emit('request:start', { path, method });

    try {
      const response = await this.executeWithRetry<T>(path, options);
      const duration = Date.now() - startTime;

      this.emit('request:end', { path, method, duration, status: response.status });

      return response;
    } catch (error) {
      this.emit('request:error', { path, method, error: error as Error });
      throw error;
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    path: string,
    options: RequestOptions
  ): Promise<ApiResponse<T>> {
    const method = options.method ?? 'GET';
    const maxAttempts = options.skipRetry ? 1 : this.config.retries;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.executeRequest<T>(path, options);
      } catch (error) {
        lastError = error as Error;

        const shouldRetry =
          attempt < maxAttempts &&
          error instanceof TipStreamError &&
          error.isRetryable;

        if (shouldRetry) {
          this.emit('request:retry', { path, method, attempt, maxAttempts });

          // Exponential backoff with jitter
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 100;
          await this.sleep(delay + jitter);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute a single request
   */
  private async executeRequest<T>(
    path: string,
    options: RequestOptions
  ): Promise<ApiResponse<T>> {
    const method = options.method ?? 'GET';
    const timeout = options.timeout ?? this.config.timeout;
    const startTime = Date.now();

    // Build URL with query parameters
    const url = this.buildUrl(path, options.params);

    // Build headers
    const headers = this.buildHeaders(options);

    // Serialize body
    const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;

    // Add signature if signer is configured
    if (this.requestSigner) {
      const timestamp = Date.now();
      const signature = this.requestSigner.sign({
        method,
        path,
        body,
        timestamp,
      });
      headers['X-Signature'] = signature;
      headers['X-Timestamp'] = timestamp.toString();
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine with user-provided signal
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // Parse response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Handle error responses
      if (!response.ok) {
        const errorBody = await this.parseErrorResponse(response);
        throw new TipStreamError(
          errorBody.message,
          response.status,
          errorBody.code,
          errorBody.details
        );
      }

      // Parse successful response
      const data = (await response.json()) as T;

      return {
        data,
        status: response.status,
        headers: responseHeaders,
        duration,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof TipStreamError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(timeout);
        }
        throw new NetworkError(error.message);
      }

      throw new NetworkError('Unknown network error');
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(normalizedPath, this.config.baseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Build request headers
   */
  private buildHeaders(options: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      'User-Agent': '@tipstream/sdk-core/1.0.0-alpha.0',
      ...this.config.defaultHeaders,
      ...options.headers,
    };

    return headers;
  }

  /**
   * Parse error response body
   */
  private async parseErrorResponse(response: Response): Promise<ApiErrorResponse> {
    try {
      const body = await response.json();
      return {
        message: body.message ?? body.error ?? response.statusText,
        code: body.code,
        details: body.details,
      };
    } catch {
      return {
        message: response.statusText || `HTTP ${response.status}`,
      };
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods

  /**
   * Make a GET request
   */
  public get<T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  public post<T = unknown>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  /**
   * Make a PUT request
   */
  public put<T = unknown>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  /**
   * Make a PATCH request
   */
  public patch<T = unknown>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  /**
   * Make a DELETE request
   */
  public delete<T = unknown>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}
