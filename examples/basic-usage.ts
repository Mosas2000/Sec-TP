/**
 * Basic Usage Example
 * 
 * This example demonstrates the fundamental usage of the TipStream SDK.
 */

import { TipStreamClient } from '@tipstream/sdk-core';

// Configuration
const API_BASE_URL = process.env.TIPSTREAM_API_URL || 'https://api.tipstream.io';
const API_KEY = process.env.TIPSTREAM_API_KEY;

async function main() {
  // 1. Initialize the client
  const client = new TipStreamClient({
    baseUrl: API_BASE_URL,
    apiKey: API_KEY,
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  });

  // 2. Set up event listeners
  client.on('request', ({ url, method }) => {
    console.log(`[Request] ${method} ${url}`);
  });

  client.on('response', ({ status, duration }) => {
    console.log(`[Response] Status: ${status}, Duration: ${duration}ms`);
  });

  client.on('error', (error) => {
    console.error(`[Error] ${error.message}`);
  });

  client.on('retry', ({ attempt, maxRetries, error }) => {
    console.log(`[Retry] Attempt ${attempt}/${maxRetries} - ${error.message}`);
  });

  try {
    // 3. Make GET request
    console.log('\n--- GET Request ---');
    const users = await client.get('/users');
    console.log('Users:', users);

    // 4. Make POST request
    console.log('\n--- POST Request ---');
    const newUser = await client.post('/users', {
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'developer'
      }
    });
    console.log('Created user:', newUser);

    // 5. Make PUT request
    console.log('\n--- PUT Request ---');
    const updatedUser = await client.put(`/users/${newUser.id}`, {
      body: {
        name: 'John Smith',
        email: 'john.smith@example.com'
      }
    });
    console.log('Updated user:', updatedUser);

    // 6. Make PATCH request
    console.log('\n--- PATCH Request ---');
    const patchedUser = await client.patch(`/users/${newUser.id}`, {
      body: {
        status: 'active'
      }
    });
    console.log('Patched user:', patchedUser);

    // 7. Make DELETE request
    console.log('\n--- DELETE Request ---');
    await client.delete(`/users/${newUser.id}`);
    console.log('User deleted');

    // 8. Using query parameters
    console.log('\n--- Query Parameters ---');
    const filteredUsers = await client.get('/users', {
      params: {
        role: 'admin',
        status: 'active',
        limit: '10'
      }
    });
    console.log('Filtered users:', filteredUsers);

    // 9. Custom headers
    console.log('\n--- Custom Headers ---');
    const data = await client.get('/protected-resource', {
      headers: {
        'X-Custom-Header': 'custom-value',
        'Accept-Language': 'en-US'
      }
    });
    console.log('Protected data:', data);

  } catch (error) {
    if (error.name === 'TimeoutError') {
      console.error('Request timed out');
    } else if (error.name === 'NetworkError') {
      console.error('Network error:', error.message);
    } else if (error.statusCode) {
      console.error(`API Error (${error.statusCode}):`, error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Run example
main().catch(console.error);
