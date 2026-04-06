import type { ApiResponse } from '../types.js';

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];
  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
  /** Cursor for next page (if using cursor pagination) */
  nextCursor?: string;
  /** Cursor for previous page (if using cursor pagination) */
  prevCursor?: string;
}

/**
 * Extract pagination metadata from API response
 */
export function extractPagination<T>(
  response: ApiResponse<PaginatedResponse<T>>
): PaginationMeta {
  return response.data.pagination;
}

/**
 * Check if there are more pages available
 */
export function hasMorePages<T>(response: ApiResponse<PaginatedResponse<T>>): boolean {
  return response.data.pagination.hasNext;
}

/**
 * Generic list response
 */
export interface ListResponse<T> {
  data: T[];
  meta?: Record<string, unknown>;
}

/**
 * Generic single item response
 */
export interface ItemResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Response with included relations
 */
export interface ResponseWithIncludes<T, I extends Record<string, unknown[]>> {
  data: T;
  included: I;
}

/**
 * Batch operation response
 */
export interface BatchResponse<T> {
  /** Successfully processed items */
  succeeded: T[];
  /** Failed items with error details */
  failed: Array<{
    item: unknown;
    error: string;
    code?: string;
  }>;
  /** Total items processed */
  total: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failureCount: number;
}

/**
 * Response interceptor type
 */
export type ResponseInterceptor<T = unknown> = (
  response: ApiResponse<T>
) => ApiResponse<T> | Promise<ApiResponse<T>>;

/**
 * Response interceptor chain for processing responses
 */
export class ResponseInterceptorChain {
  private interceptors: ResponseInterceptor[] = [];

  /**
   * Add an interceptor to the chain
   */
  public add<T>(interceptor: ResponseInterceptor<T>): void {
    this.interceptors.push(interceptor as ResponseInterceptor);
  }

  /**
   * Remove an interceptor from the chain
   */
  public remove<T>(interceptor: ResponseInterceptor<T>): void {
    const index = this.interceptors.indexOf(interceptor as ResponseInterceptor);
    if (index !== -1) {
      this.interceptors.splice(index, 1);
    }
  }

  /**
   * Execute all interceptors in sequence
   */
  public async execute<T>(response: ApiResponse<T>): Promise<ApiResponse<T>> {
    let result: ApiResponse<unknown> = response;
    for (const interceptor of this.interceptors) {
      result = await interceptor(result);
    }
    return result as ApiResponse<T>;
  }
}

/**
 * Transform response data using a mapper function
 */
export function mapResponseData<T, U>(
  response: ApiResponse<T>,
  mapper: (data: T) => U
): ApiResponse<U> {
  return {
    ...response,
    data: mapper(response.data),
  };
}

/**
 * Unwrap response data (extract just the data, discarding metadata)
 */
export function unwrapResponse<T>(response: ApiResponse<T>): T {
  return response.data;
}

/**
 * Extract items from a paginated response
 */
export function extractItems<T>(response: ApiResponse<PaginatedResponse<T>>): T[] {
  return response.data.items;
}

/**
 * Response transformer for common data transformations
 */
export class ResponseTransformer {
  /**
   * Convert date strings to Date objects
   */
  public static parseDates<T extends Record<string, unknown>>(
    data: T,
    dateFields: string[]
  ): T {
    const result = { ...data };
    for (const field of dateFields) {
      if (field in result && typeof result[field] === 'string') {
        (result as Record<string, unknown>)[field] = new Date(result[field] as string);
      }
    }
    return result;
  }

  /**
   * Rename fields in response data
   */
  public static renameFields<T extends Record<string, unknown>>(
    data: T,
    fieldMap: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const newKey = fieldMap[key] ?? key;
      result[newKey] = value;
    }
    return result;
  }

  /**
   * Flatten nested response data
   */
  public static flatten<T extends Record<string, unknown>>(
    data: T,
    nestedKey: string
  ): Record<string, unknown> {
    const nested = data[nestedKey];
    if (typeof nested === 'object' && nested !== null) {
      const { [nestedKey]: _, ...rest } = data;
      return { ...rest, ...(nested as Record<string, unknown>) };
    }
    return data;
  }
}

/**
 * Response cache entry
 */
interface CacheEntry<T> {
  data: ApiResponse<T>;
  timestamp: number;
  ttl: number;
}

/**
 * Simple in-memory response cache
 */
export class ResponseCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  /**
   * Get a cached response
   */
  public get<T>(key: string): ApiResponse<T> | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as ApiResponse<T>;
  }

  /**
   * Set a cached response
   */
  public set<T>(key: string, data: ApiResponse<T>, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Delete a cached response
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached responses
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }
}
