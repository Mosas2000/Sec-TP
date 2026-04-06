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

// Re-export API module
export * from './api/requests.js';
export * from './api/responses.js';

// Re-export utilities
export * from './utils/helpers.js';
