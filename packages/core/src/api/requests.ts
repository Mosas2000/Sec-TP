import type { HttpMethod, RequestOptions } from '../types.js';

/**
 * Request builder for constructing API requests with a fluent interface
 *
 * @example
 * ```typescript
 * const request = new RequestBuilder()
 *   .setMethod('POST')
 *   .setPath('/users')
 *   .setBody({ name: 'John' })
 *   .addHeader('X-Custom', 'value')
 *   .addParam('include', 'profile')
 *   .build();
 * ```
 */
export class RequestBuilder {
  private method: HttpMethod = 'GET';
  private path = '/';
  private headers: Record<string, string> = {};
  private params: Record<string, string | number | boolean> = {};
  private body?: unknown;
  private timeout?: number;
  private skipRetry = false;

  /**
   * Set the HTTP method
   */
  public setMethod(method: HttpMethod): this {
    this.method = method;
    return this;
  }

  /**
   * Set the request path
   */
  public setPath(path: string): this {
    this.path = path;
    return this;
  }

  /**
   * Set the request body
   */
  public setBody(body: unknown): this {
    this.body = body;
    return this;
  }

  /**
   * Add a single header
   */
  public addHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  /**
   * Add multiple headers
   */
  public addHeaders(headers: Record<string, string>): this {
    Object.assign(this.headers, headers);
    return this;
  }

  /**
   * Add a single query parameter
   */
  public addParam(key: string, value: string | number | boolean): this {
    this.params[key] = value;
    return this;
  }

  /**
   * Add multiple query parameters
   */
  public addParams(params: Record<string, string | number | boolean>): this {
    Object.assign(this.params, params);
    return this;
  }

  /**
   * Set request timeout
   */
  public setTimeout(timeout: number): this {
    this.timeout = timeout;
    return this;
  }

  /**
   * Skip retry logic for this request
   */
  public noRetry(): this {
    this.skipRetry = true;
    return this;
  }

  /**
   * Get the path for this request
   */
  public getPath(): string {
    return this.path;
  }

  /**
   * Build the request options
   */
  public build(): RequestOptions {
    return {
      method: this.method,
      headers: Object.keys(this.headers).length > 0 ? this.headers : undefined,
      params: Object.keys(this.params).length > 0 ? this.params : undefined,
      body: this.body,
      timeout: this.timeout,
      skipRetry: this.skipRetry || undefined,
    };
  }
}

/**
 * Pagination parameters for list requests
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Add pagination to a request builder
 */
export function withPagination(
  builder: RequestBuilder,
  pagination: PaginationParams
): RequestBuilder {
  if (pagination.page !== undefined) {
    builder.addParam('page', pagination.page);
  }
  if (pagination.limit !== undefined) {
    builder.addParam('limit', pagination.limit);
  }
  if (pagination.cursor !== undefined) {
    builder.addParam('cursor', pagination.cursor);
  }
  if (pagination.sortBy !== undefined) {
    builder.addParam('sort_by', pagination.sortBy);
  }
  if (pagination.sortOrder !== undefined) {
    builder.addParam('sort_order', pagination.sortOrder);
  }
  return builder;
}

/**
 * Filter parameters for filtering list requests
 */
export interface FilterParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Add filters to a request builder
 */
export function withFilters(builder: RequestBuilder, filters: FilterParams): RequestBuilder {
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      // Join arrays with commas for multi-value filters
      builder.addParam(`filter[${key}]`, value.join(','));
    } else {
      builder.addParam(`filter[${key}]`, value);
    }
  }
  return builder;
}

/**
 * Include relations in the request
 */
export function withIncludes(builder: RequestBuilder, includes: string[]): RequestBuilder {
  if (includes.length > 0) {
    builder.addParam('include', includes.join(','));
  }
  return builder;
}

/**
 * Select specific fields in the response
 */
export function withFields(
  builder: RequestBuilder,
  fields: Record<string, string[]>
): RequestBuilder {
  for (const [resource, fieldList] of Object.entries(fields)) {
    if (fieldList.length > 0) {
      builder.addParam(`fields[${resource}]`, fieldList.join(','));
    }
  }
  return builder;
}

/**
 * Request interceptor type
 */
export type RequestInterceptor = (options: RequestOptions) => RequestOptions | Promise<RequestOptions>;

/**
 * Request interceptor chain for modifying requests before they are sent
 */
export class RequestInterceptorChain {
  private interceptors: RequestInterceptor[] = [];

  /**
   * Add an interceptor to the chain
   */
  public add(interceptor: RequestInterceptor): void {
    this.interceptors.push(interceptor);
  }

  /**
   * Remove an interceptor from the chain
   */
  public remove(interceptor: RequestInterceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index !== -1) {
      this.interceptors.splice(index, 1);
    }
  }

  /**
   * Execute all interceptors in sequence
   */
  public async execute(options: RequestOptions): Promise<RequestOptions> {
    let result = options;
    for (const interceptor of this.interceptors) {
      result = await interceptor(result);
    }
    return result;
  }
}
