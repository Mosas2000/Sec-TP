/**
 * TipStream Integration Example
 * 
 * This example shows how to integrate all SDK packages together
 * for a complete TipStream application.
 */

import { TipStreamClient } from '@tipstream/sdk-core';
import { 
  RequestSigner, 
  Encryptor, 
  Validator, 
  AuditLogger,
  ValidationSchema 
} from '@tipstream/sdk-security';
import { 
  MetricsCollector, 
  ConsoleReporter, 
  FileReporter,
  Analytics 
} from '@tipstream/sdk-metrics';

// Configuration
const config = {
  apiUrl: process.env.TIPSTREAM_API_URL || 'https://api.tipstream.io',
  apiKey: process.env.TIPSTREAM_API_KEY || '',
  signingSecret: process.env.TIPSTREAM_SIGNING_SECRET || '',
  encryptionKey: process.env.TIPSTREAM_ENCRYPTION_KEY || '',
  environment: process.env.NODE_ENV || 'development'
};

// Initialize metrics
const metrics = new MetricsCollector({
  flushInterval: 10000,
  defaultTags: {
    app: 'tipstream-integration',
    environment: config.environment
  }
});

// Add reporters based on environment
if (config.environment === 'production') {
  metrics.addReporter(new FileReporter({ 
    path: './logs/metrics.log',
    format: 'json'
  }));
} else {
  metrics.addReporter(new ConsoleReporter({ prefix: '[Metrics]' }));
}

// Initialize analytics
const analytics = new Analytics({
  sessionTimeout: 1800000 // 30 minutes
});

// Initialize audit logger
const auditLogger = new AuditLogger({
  storagePath: './logs/audit',
  maxFileSize: 10 * 1024 * 1024
});

// Initialize request signer
const signer = new RequestSigner({
  algorithm: 'hmac-sha256',
  secretKey: config.signingSecret,
  timestampTolerance: 300000 // 5 minutes
});

// Initialize encryptor for sensitive data
const encryptor = config.encryptionKey 
  ? new Encryptor(Buffer.from(config.encryptionKey, 'hex'))
  : null;

// User validation schema
const userSchema: ValidationSchema = {
  name: { 
    type: 'string', 
    required: true, 
    minLength: 2, 
    maxLength: 100 
  },
  email: { 
    type: 'string', 
    required: true, 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
  },
  age: { 
    type: 'number', 
    min: 0, 
    max: 150 
  },
  role: { 
    type: 'string', 
    enum: ['admin', 'user', 'moderator'] 
  }
};

const userValidator = new Validator(userSchema);

// Create TipStream client with all integrations
const client = new TipStreamClient({
  baseUrl: config.apiUrl,
  apiKey: config.apiKey,
  timeout: 30000,
  retries: 3,

  // Request interceptor - sign and track requests
  requestInterceptor: async (requestConfig) => {
    const startTime = Date.now();

    // Generate signature
    const signature = signer.sign({
      method: requestConfig.method || 'GET',
      url: requestConfig.url || '',
      body: requestConfig.body,
      timestamp: startTime
    });

    // Track request
    metrics.increment('api.requests', { 
      endpoint: new URL(requestConfig.url || '', config.apiUrl).pathname,
      method: requestConfig.method || 'GET'
    });

    analytics.track('api.request', {
      endpoint: requestConfig.url,
      method: requestConfig.method
    });

    return {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        'X-Signature': signature,
        'X-Timestamp': startTime.toString(),
        'X-Request-ID': crypto.randomUUID()
      },
      metadata: {
        ...requestConfig.metadata,
        startTime
      }
    };
  },

  // Response interceptor - track response metrics
  responseInterceptor: async (response, requestConfig) => {
    const duration = Date.now() - (requestConfig.metadata?.startTime || Date.now());

    metrics.timing('api.response_time', duration, {
      endpoint: new URL(requestConfig.url || '', config.apiUrl).pathname,
      status: response.status?.toString() || 'unknown'
    });

    return response;
  }
});

// Event handlers
client.on('error', (error) => {
  metrics.increment('api.errors', { 
    type: error.name,
    code: error.code || 'unknown'
  });

  analytics.trackError(error, {
    context: 'api_request'
  });

  auditLogger.log({
    action: 'api.error',
    actor: 'system',
    resource: 'api',
    details: {
      error: error.message,
      code: error.code,
      stack: error.stack
    }
  });
});

client.on('retry', ({ attempt, maxRetries }) => {
  metrics.increment('api.retries', { attempt: attempt.toString() });
});

// Application functions
async function createUser(userData: Record<string, unknown>) {
  // Validate input
  const validation = userValidator.validate(userData);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Encrypt sensitive fields if encryptor is available
  const processedData = { ...userData };
  if (encryptor && userData.ssn) {
    const encrypted = encryptor.encrypt(String(userData.ssn));
    processedData.ssn = Buffer.concat([
      encrypted.iv,
      encrypted.authTag,
      encrypted.ciphertext
    ]).toString('base64');
    processedData.ssnEncrypted = true;
  }

  // Make request
  const user = await client.post('/users', { body: processedData });

  // Audit log
  auditLogger.log({
    action: 'user.create',
    actor: 'api',
    resource: `user:${user.id}`,
    details: { email: userData.email }
  });

  return user;
}

async function getUsers(filters?: Record<string, string>) {
  const users = await client.get('/users', { params: filters });

  auditLogger.log({
    action: 'user.list',
    actor: 'api',
    resource: 'users',
    details: { filters, count: users.length }
  });

  return users;
}

async function updateUser(userId: string, updates: Record<string, unknown>) {
  // Validate updates
  const validation = userValidator.validate(updates, { partial: true });
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const user = await client.put(`/users/${userId}`, { body: updates });

  auditLogger.log({
    action: 'user.update',
    actor: 'api',
    resource: `user:${userId}`,
    details: { fields: Object.keys(updates) }
  });

  return user;
}

async function deleteUser(userId: string) {
  await client.delete(`/users/${userId}`);

  auditLogger.log({
    action: 'user.delete',
    actor: 'api',
    resource: `user:${userId}`,
    details: {}
  });
}

// Main example flow
async function main() {
  console.log('=== TipStream Integration Example ===\n');

  // Start metrics collection
  metrics.start();

  try {
    // Create a user
    console.log('Creating user...');
    const user = await createUser({
      name: 'Jane Doe',
      email: 'jane@example.com',
      age: 28,
      role: 'user'
    });
    console.log('Created:', user);

    // Get all users
    console.log('\nFetching users...');
    const users = await getUsers({ role: 'user' });
    console.log('Users:', users);

    // Update user
    console.log('\nUpdating user...');
    const updated = await updateUser(user.id, { 
      role: 'moderator' 
    });
    console.log('Updated:', updated);

    // Delete user
    console.log('\nDeleting user...');
    await deleteUser(user.id);
    console.log('Deleted');

    // Print session stats
    console.log('\n=== Session Statistics ===');
    const stats = analytics.getSessionStats();
    console.log(`Events: ${stats.eventCount}`);
    console.log(`Errors: ${stats.errorCount}`);
    console.log(`Duration: ${stats.duration}ms`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Graceful shutdown
    await metrics.stop();
    console.log('\nMetrics flushed. Goodbye!');
  }
}

// Run
main().catch(console.error);
