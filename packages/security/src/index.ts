/**
 * @tipstream/sdk-security
 *
 * Security utilities for TipStream SDK - encryption, signing,
 * validation, and audit logging.
 *
 * @packageDocumentation
 */

// Encryption
export {
  Encryptor,
  PasswordEncryptor,
  generateKey,
  generateSalt,
  deriveKey,
  generateToken,
  hash,
  secureCompare,
  ENCRYPTION_ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  SALT_LENGTH,
} from './encryption.js';

export type { EncryptedData, EncryptionOptions } from './encryption.js';

// Signing
export {
  RequestSigner,
  WebhookVerifier,
} from './signing.js';

export type {
  SigningAlgorithm,
  SignableRequest,
  SignatureResult,
  RequestSignerConfig,
} from './signing.js';

// Validation
export {
  validate,
  sanitize,
  sanitizeObject,
  hasSqlInjection,
  hasPathTraversal,
  hasXss,
} from './validation.js';

export type {
  FieldType,
  FieldSchema,
  Schema,
  ValidationError,
  ValidationResult,
  SanitizeOptions,
} from './validation.js';

// Audit Logging
export {
  AuditLogger,
  createChildLogger,
} from './audit.js';

export type {
  AuditLogLevel,
  AuditEventCategory,
  AuditEvent,
  AuditLogEntry,
  AuditOutput,
  AuditLoggerConfig,
} from './audit.js';

/**
 * SDK Version
 */
export const VERSION = '1.0.0-alpha.0';
