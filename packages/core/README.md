# @tipstream/sdk-core

Core SDK client for the TipStream API.

## Installation

```bash
npm install @tipstream/sdk-core
```

## Usage

```typescript
import { TipStreamClient } from '@tipstream/sdk-core';

const client = new TipStreamClient({
  apiKey: process.env.TIPSTREAM_API_KEY,
  baseUrl: 'https://api.tipstream.example.com',
});

// Make API requests
const response = await client.request('/users', {
  method: 'GET',
});

// With request options
const data = await client.request('/users', {
  method: 'POST',
  body: { name: 'John Doe' },
  headers: { 'X-Custom-Header': 'value' },
});
```

## Configuration

```typescript
interface TipStreamClientConfig {
  apiKey: string;          // Required: API key for authentication
  baseUrl?: string;        // Optional: Base URL (default: https://api.tipstream.example.com)
  timeout?: number;        // Optional: Request timeout in ms (default: 30000)
  retries?: number;        // Optional: Number of retries (default: 3)
  retryDelay?: number;     // Optional: Delay between retries in ms (default: 1000)
}
```

## API

### `TipStreamClient`

#### `request<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>`

Make an API request.

#### `get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>`

Convenience method for GET requests.

#### `post<T>(path: string, body: unknown, options?: RequestOptions): Promise<ApiResponse<T>>`

Convenience method for POST requests.

#### `put<T>(path: string, body: unknown, options?: RequestOptions): Promise<ApiResponse<T>>`

Convenience method for PUT requests.

#### `delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>`

Convenience method for DELETE requests.

## License

MIT
