/**
 * @tipstream/sdk-core
 *
 * Core SDK client for TipStream API with type-safe request handling,
 * retry logic, and extensible architecture.
 *
 * @packageDocumentation
 */

// Main exports
export { TipStreamClient } from './client.js';

// Type exports
export type {
  TipStreamClientConfig,
  RequestOptions,
  ApiResponse,
  ApiErrorResponse,
  HttpMethod,
  ClientEvents,
  EventListener,
  RequestSigner,
} from './types.js';

// Error exports
export { TipStreamError, TimeoutError, NetworkError } from './types.js';

// Request builders and helpers
export {
  RequestBuilder,
  RequestInterceptorChain,
  withPagination,
  withFilters,
  withIncludes,
  withFields,
} from './api/requests.js';

export type {
  PaginationParams,
  FilterParams,
  RequestInterceptor,
} from './api/requests.js';

// Response types and utilities
export {
  ResponseInterceptorChain,
  ResponseCache,
  ResponseTransformer,
  mapResponseData,
  unwrapResponse,
  extractItems,
  extractPagination,
  hasMorePages,
} from './api/responses.js';

export type {
  PaginatedResponse,
  PaginationMeta,
  ListResponse,
  ItemResponse,
  ResponseWithIncludes,
  BatchResponse,
  ResponseInterceptor,
} from './api/responses.js';

// Utility functions
export {
  deepMerge,
  debounce,
  throttle,
  retry,
  createId,
  isPlainObject,
  omit,
  pick,
  toCamelCase,
  toSnakeCase,
  transformKeys,
  formatBytes,
  formatDuration,
  safeJsonParse,
  AsyncQueue,
} from './utils/helpers.js';

/**
 * SDK Version
 */
export const VERSION = '1.0.0-alpha.0';
