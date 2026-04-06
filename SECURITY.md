# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: [security contact to be added]
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

### Disclosure Policy

- We follow coordinated disclosure
- Security advisories will be published after fixes are available
- Credit will be given to reporters (unless anonymity is requested)

## Security Best Practices for Users

### API Key Management

```typescript
// ✅ DO: Use environment variables
const client = new TipStreamClient({
  apiKey: process.env.TIPSTREAM_API_KEY,
});

// ❌ DON'T: Hardcode credentials
const client = new TipStreamClient({
  apiKey: 'sk_live_xxxxx', // Never do this!
});
```

### Request Signing

Always enable request signing for sensitive operations:

```typescript
import { signRequest } from '@tipstream/sdk-security';

const signedRequest = signRequest(request, {
  algorithm: 'HMAC-SHA256',
  secret: process.env.SIGNING_SECRET,
});
```

### Input Validation

Use the security package for input validation:

```typescript
import { validate, sanitize } from '@tipstream/sdk-security';

const cleanInput = sanitize(userInput);
const isValid = validate(cleanInput, schema);
```

## Security Features

### Encryption
- AES-256-GCM for data encryption
- RSA for key exchange
- Secure key derivation with PBKDF2

### Request Signing
- HMAC-SHA256 signatures
- Timestamp-based replay protection
- Nonce support for additional security

### Input Validation
- Schema-based validation
- XSS prevention
- SQL injection protection
- Path traversal prevention

### Audit Logging
- Comprehensive security event logging
- Tamper-evident log format
- Configurable log levels

## Dependencies

We regularly audit our dependencies:

- Weekly automated `npm audit`
- Snyk vulnerability scanning
- Dependabot alerts enabled
- SBOM generation for each release

## Contact

For security concerns, please contact the security team through the appropriate channels (to be configured).
