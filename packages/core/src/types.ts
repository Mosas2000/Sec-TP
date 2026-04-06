/**
 * Configuration options for TipStreamClient
 */
export interface TipStreamClientConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for API requests */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts for failed requests */
  retries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Custom headers to include in all requests */
  defaultHeaders?: Record<string, string>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * HTTP methods supported by the client
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Request options for individual API calls
 */
export interface RequestOptions {
  /** HTTP method */
  method?: HttpMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON serialized) */
  body?: unknown;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request timeout override */
  timeout?: number;
  /** Abort signal for request cancellation */
  signal?: AbortSignal;
  /** Skip retry logic for this request */
  skipRetry?: boolean;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  /** Response data */
  data: T;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Request duration in milliseconds */
  duration: number;
}

/**
 * Error response from the API
 */
export interface ApiErrorResponse {
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * SDK error class with additional context
 */
export class TipStreamError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TipStreamError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isRetryable = status >= 500 || status === 429;
  }
}

/**
 * Timeout error for requests that exceed the timeout limit
 */
export class TimeoutError extends TipStreamError {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`, 408, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

/**
 * Network error for connection failures
 */
export class NetworkError extends TipStreamError {
  constructor(message: string) {
    super(message, 0, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Event types emitted by the client
 */
export interface ClientEvents {
  'request:start': { path: string; method: HttpMethod };
  'request:end': { path: string; method: HttpMethod; duration: number; status: number };
  'request:error': { path: string; method: HttpMethod; error: Error };
  'request:retry': { path: string; method: HttpMethod; attempt: number; maxAttempts: number };
}

/**
 * Event listener type
 */
export type EventListener<T> = (event: T) => void;

/**
 * Security signing interface (optional integration with security package)
 */
export interface RequestSigner {
  sign(request: { method: HttpMethod; path: string; body?: string; timestamp: number }): string;
}
