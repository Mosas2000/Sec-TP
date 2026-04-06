/**
 * Security Features Demo
 * 
 * This example demonstrates all security features of the TipStream SDK:
 * - Encryption/Decryption
 * - Request Signing
 * - Input Validation
 * - Audit Logging
 */

import {
  Encryptor,
  PasswordEncryptor,
  RequestSigner,
  WebhookVerifier,
  Validator,
  Sanitizer,
  AuditLogger,
  ValidationSchema
} from '@tipstream/sdk-security';

// ============================================================
// 1. ENCRYPTION DEMO
// ============================================================

async function encryptionDemo() {
  console.log('=== Encryption Demo ===\n');

  // Generate a secure key
  const key = Encryptor.generateKey();
  console.log('Generated key:', key.toString('hex').substring(0, 32) + '...');

  // Create encryptor
  const encryptor = new Encryptor(key);

  // Encrypt sensitive data
  const sensitiveData = 'Social Security Number: 123-45-6789';
  console.log('\nOriginal:', sensitiveData);

  const encrypted = encryptor.encrypt(sensitiveData);
  console.log('Encrypted:', {
    iv: encrypted.iv.toString('hex').substring(0, 16) + '...',
    authTag: encrypted.authTag.toString('hex').substring(0, 16) + '...',
    ciphertext: encrypted.ciphertext.toString('hex').substring(0, 32) + '...'
  });

  // Decrypt
  const decrypted = encryptor.decrypt(encrypted);
  console.log('Decrypted:', decrypted.toString());

  // Password-based encryption
  console.log('\n--- Password-Based Encryption ---');
  const passwordEncryptor = new PasswordEncryptor();
  
  const password = 'user-secret-password';
  const data = 'Confidential information';
  
  const passwordEncrypted = await passwordEncryptor.encrypt(data, password);
  console.log('Password-encrypted (base64):', 
    passwordEncrypted.substring(0, 50) + '...');

  const passwordDecrypted = await passwordEncryptor.decrypt(
    passwordEncrypted, 
    password
  );
  console.log('Password-decrypted:', passwordDecrypted);

  // Wrong password fails
  try {
    await passwordEncryptor.decrypt(passwordEncrypted, 'wrong-password');
  } catch (error) {
    console.log('Wrong password correctly rejected:', error.message);
  }
}

// ============================================================
// 2. REQUEST SIGNING DEMO
// ============================================================

function signingDemo() {
  console.log('\n=== Request Signing Demo ===\n');

  // HMAC Signing
  console.log('--- HMAC-SHA256 Signing ---');
  const hmacSigner = new RequestSigner({
    algorithm: 'hmac-sha256',
    secretKey: 'my-secret-key-for-signing',
    timestampTolerance: 300000 // 5 minutes
  });

  const request = {
    method: 'POST',
    url: '/api/users',
    body: { name: 'John Doe', email: 'john@example.com' },
    timestamp: Date.now()
  };

  const signature = hmacSigner.sign(request);
  console.log('Request:', JSON.stringify(request, null, 2));
  console.log('Signature:', signature);

  // Verify signature
  const isValid = hmacSigner.verify(request, signature);
  console.log('Signature valid:', isValid);

  // Tampered request fails
  const tamperedRequest = { ...request, body: { name: 'Evil Hacker' } };
  const isTamperedValid = hmacSigner.verify(tamperedRequest, signature);
  console.log('Tampered request valid:', isTamperedValid);

  // Authorization header
  const authHeader = hmacSigner.createAuthorizationHeader(request);
  console.log('Authorization header:', authHeader);

  // Webhook verification
  console.log('\n--- Webhook Verification ---');
  const webhookVerifier = new WebhookVerifier({
    secretKey: 'webhook-secret',
    headerName: 'X-Webhook-Signature'
  });

  const webhookPayload = JSON.stringify({ event: 'user.created', userId: '123' });
  const webhookSignature = webhookVerifier.sign(webhookPayload);
  console.log('Webhook signature:', webhookSignature);

  const webhookValid = webhookVerifier.verify(webhookPayload, webhookSignature);
  console.log('Webhook valid:', webhookValid);
}

// ============================================================
// 3. INPUT VALIDATION DEMO
// ============================================================

function validationDemo() {
  console.log('\n=== Input Validation Demo ===\n');

  // Define schema
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
    },
    tags: {
      type: 'array',
      minLength: 1,
      maxLength: 10
    }
  };

  const validator = new Validator(userSchema);

  // Valid input
  console.log('--- Valid Input ---');
  const validInput = {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    role: 'user',
    tags: ['developer', 'nodejs']
  };

  const validResult = validator.validate(validInput);
  console.log('Input:', JSON.stringify(validInput));
  console.log('Valid:', validResult.valid);

  // Invalid input
  console.log('\n--- Invalid Input ---');
  const invalidInput = {
    name: 'J', // too short
    email: 'not-an-email',
    age: 200, // too high
    role: 'superadmin' // not in enum
  };

  const invalidResult = validator.validate(invalidInput);
  console.log('Input:', JSON.stringify(invalidInput));
  console.log('Valid:', invalidResult.valid);
  console.log('Errors:', invalidResult.errors);

  // Sanitization
  console.log('\n--- Input Sanitization ---');
  const sanitizer = new Sanitizer({
    stripHtml: true,
    escapeHtml: true,
    trimWhitespace: true
  });

  const unsafeInput = '  <script>alert("XSS")</script>Hello World  ';
  console.log('Unsafe input:', JSON.stringify(unsafeInput));
  
  const sanitized = sanitizer.sanitize(unsafeInput);
  console.log('Sanitized:', JSON.stringify(sanitized));

  // XSS Detection
  console.log('\n--- Security Detection ---');
  const xssPayloads = [
    '<script>alert(1)</script>',
    'javascript:void(0)',
    '<img onerror="alert(1)">',
    'Normal text'
  ];

  xssPayloads.forEach(payload => {
    const hasXss = sanitizer.detectXss(payload);
    console.log(`"${payload.substring(0, 30)}..." - XSS: ${hasXss}`);
  });

  // SQL Injection Detection
  console.log('\n--- SQL Injection Detection ---');
  const sqlPayloads = [
    "'; DROP TABLE users; --",
    "1 OR 1=1",
    "SELECT * FROM users",
    "Normal search query"
  ];

  sqlPayloads.forEach(payload => {
    const hasSql = sanitizer.detectSqlInjection(payload);
    console.log(`"${payload.substring(0, 30)}..." - SQLi: ${hasSql}`);
  });
}

// ============================================================
// 4. AUDIT LOGGING DEMO
// ============================================================

async function auditLoggingDemo() {
  console.log('\n=== Audit Logging Demo ===\n');

  const auditLogger = new AuditLogger({
    storagePath: './demo-audit-logs',
    maxFileSize: 1024 * 1024, // 1MB
    rotationCount: 5
  });

  // Log various actions
  console.log('Logging actions...');

  auditLogger.log({
    action: 'user.login',
    actor: 'user@example.com',
    resource: 'auth',
    details: {
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0...',
      success: true
    }
  });

  auditLogger.log({
    action: 'user.permission_change',
    actor: 'admin@example.com',
    resource: 'user:123',
    details: {
      previousRole: 'user',
      newRole: 'admin',
      reason: 'Promotion'
    }
  });

  auditLogger.log({
    action: 'data.export',
    actor: 'user@example.com',
    resource: 'reports',
    details: {
      reportType: 'financial',
      recordCount: 1500,
      format: 'csv'
    }
  });

  auditLogger.log({
    action: 'security.failed_login',
    actor: 'unknown',
    resource: 'auth',
    details: {
      attemptedEmail: 'admin@example.com',
      ip: '10.0.0.1',
      failureReason: 'invalid_password'
    }
  });

  console.log('4 audit entries logged');

  // Query logs
  console.log('\n--- Query Audit Logs ---');
  
  const allLogs = await auditLogger.query({});
  console.log(`Total entries: ${allLogs.length}`);

  const loginLogs = await auditLogger.query({ action: 'user.login' });
  console.log(`Login entries: ${loginLogs.length}`);

  const securityLogs = await auditLogger.query({ 
    action: 'security.failed_login' 
  });
  console.log(`Security entries: ${securityLogs.length}`);

  // Verify integrity
  console.log('\n--- Verify Integrity ---');
  const isIntact = await auditLogger.verifyIntegrity();
  console.log(`Audit log integrity: ${isIntact ? 'INTACT' : 'COMPROMISED'}`);

  // Show log structure
  if (allLogs.length > 0) {
    console.log('\nSample log entry:');
    const sample = allLogs[0];
    console.log({
      id: sample.id,
      timestamp: new Date(sample.timestamp).toISOString(),
      action: sample.action,
      actor: sample.actor,
      resource: sample.resource,
      hash: sample.hash.substring(0, 16) + '...',
      previousHash: sample.previousHash.substring(0, 16) + '...'
    });
  }
}

// ============================================================
// 5. COMPLETE SECURITY WORKFLOW
// ============================================================

async function completeSecurityWorkflow() {
  console.log('\n=== Complete Security Workflow ===\n');
  console.log('Scenario: Secure user registration\n');

  // Initialize components
  const encryptor = new Encryptor(Encryptor.generateKey());
  const signer = new RequestSigner({
    algorithm: 'hmac-sha256',
    secretKey: 'api-signing-key'
  });
  const sanitizer = new Sanitizer({ stripHtml: true, escapeHtml: true });
  const validator = new Validator({
    username: { type: 'string', required: true, minLength: 3, maxLength: 30 },
    password: { type: 'string', required: true, minLength: 8 },
    email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
  });

  // Simulate user input
  const userInput = {
    username: '  <b>john_doe</b>  ',
    password: 'SecurePass123!',
    email: 'john@example.com'
  };

  console.log('Step 1: Raw user input');
  console.log(JSON.stringify(userInput, null, 2));

  // Step 2: Sanitize
  console.log('\nStep 2: Sanitize input');
  const sanitizedInput = {
    username: sanitizer.sanitize(userInput.username),
    password: userInput.password, // Don't sanitize passwords
    email: sanitizer.sanitize(userInput.email)
  };
  console.log(JSON.stringify(sanitizedInput, null, 2));

  // Step 3: Validate
  console.log('\nStep 3: Validate input');
  const validation = validator.validate(sanitizedInput);
  if (!validation.valid) {
    console.log('Validation failed:', validation.errors);
    return;
  }
  console.log('Validation passed');

  // Step 4: Encrypt sensitive data
  console.log('\nStep 4: Encrypt sensitive data');
  const encryptedPassword = encryptor.encrypt(sanitizedInput.password);
  const secureData = {
    username: sanitizedInput.username,
    passwordHash: Buffer.concat([
      encryptedPassword.iv,
      encryptedPassword.authTag,
      encryptedPassword.ciphertext
    ]).toString('base64'),
    email: sanitizedInput.email
  };
  console.log('Password encrypted');

  // Step 5: Sign the request
  console.log('\nStep 5: Sign API request');
  const request = {
    method: 'POST',
    url: '/api/register',
    body: secureData,
    timestamp: Date.now()
  };
  const signature = signer.sign(request);
  console.log('Request signed:', signature.substring(0, 32) + '...');

  // Step 6: Verify on "server side"
  console.log('\nStep 6: Server-side verification');
  const isValidSignature = signer.verify(request, signature);
  console.log('Signature verified:', isValidSignature);

  console.log('\n✓ Complete security workflow executed successfully');
}

// ============================================================
// RUN ALL DEMOS
// ============================================================

async function main() {
  try {
    await encryptionDemo();
    signingDemo();
    validationDemo();
    await auditLoggingDemo();
    await completeSecurityWorkflow();

    console.log('\n=== All Security Demos Complete ===');
  } catch (error) {
    console.error('Demo error:', error);
  }
}

main();
