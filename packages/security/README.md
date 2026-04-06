# @tipstream/sdk-security

Security utilities for the TipStream SDK - encryption, signing, validation, and audit logging.

## Installation

```bash
npm install @tipstream/sdk-security
```

## Features

- 🔐 **Encryption** - AES-256-GCM encryption with secure key management
- ✍️ **Request Signing** - HMAC-SHA256 and RSA request signatures
- ✅ **Validation** - Schema-based input validation with sanitization
- 📝 **Audit Logging** - Comprehensive security event logging

## Usage

### Encryption

```typescript
import { Encryptor, generateKey } from '@tipstream/sdk-security';

// Generate a secure key
const key = generateKey();

// Create encryptor instance
const encryptor = new Encryptor(key);

// Encrypt data
const encrypted = encryptor.encrypt('sensitive data');

// Decrypt data
const decrypted = encryptor.decrypt(encrypted);
```

### Request Signing

```typescript
import { RequestSigner } from '@tipstream/sdk-security';

const signer = new RequestSigner({
  algorithm: 'HMAC-SHA256',
  secret: process.env.SIGNING_SECRET,
});

// Sign a request
const signature = signer.sign({
  method: 'POST',
  path: '/api/users',
  body: JSON.stringify({ name: 'John' }),
  timestamp: Date.now(),
});

// Verify a signature
const isValid = signer.verify(signature, {
  method: 'POST',
  path: '/api/users',
  body: JSON.stringify({ name: 'John' }),
  timestamp: Date.now(),
});
```

### Input Validation

```typescript
import { validate, sanitize, Schema } from '@tipstream/sdk-security';

const userSchema: Schema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  email: { type: 'string', required: true, pattern: 'email' },
  age: { type: 'number', min: 0, max: 150 },
};

// Validate input
const result = validate(userInput, userSchema);
if (!result.valid) {
  console.error(result.errors);
}

// Sanitize input (XSS prevention)
const clean = sanitize(userInput);
```

### Audit Logging

```typescript
import { AuditLogger } from '@tipstream/sdk-security';

const logger = new AuditLogger({
  level: 'info',
  output: 'file',
  path: './audit.log',
});

// Log security events
logger.log({
  event: 'authentication',
  action: 'login',
  userId: '123',
  success: true,
  ip: '192.168.1.1',
});
```

## License

MIT
