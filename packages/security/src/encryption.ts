import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

/**
 * Encryption algorithm used
 */
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;

/**
 * Key length in bytes (256 bits)
 */
export const KEY_LENGTH = 32;

/**
 * IV length in bytes (96 bits for GCM)
 */
export const IV_LENGTH = 12;

/**
 * Auth tag length in bytes
 */
export const AUTH_TAG_LENGTH = 16;

/**
 * Salt length for key derivation
 */
export const SALT_LENGTH = 16;

/**
 * Encrypted data format
 */
export interface EncryptedData {
  /** Initialization vector (base64) */
  iv: string;
  /** Encrypted content (base64) */
  content: string;
  /** Authentication tag (base64) */
  tag: string;
  /** Salt used for key derivation (base64), if password-based */
  salt?: string;
}

/**
 * Encryption options
 */
export interface EncryptionOptions {
  /** Additional authenticated data */
  aad?: Buffer;
}

/**
 * Generate a cryptographically secure random key
 */
export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

/**
 * Generate a key from a password using scrypt
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  });
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

/**
 * Encryptor class for AES-256-GCM encryption
 *
 * @example
 * ```typescript
 * const key = generateKey();
 * const encryptor = new Encryptor(key);
 *
 * const encrypted = encryptor.encrypt('secret data');
 * const decrypted = encryptor.decrypt(encrypted);
 * ```
 */
export class Encryptor {
  private readonly key: Buffer;

  constructor(key: Buffer | string) {
    if (typeof key === 'string') {
      // Assume base64 encoded key
      this.key = Buffer.from(key, 'base64');
    } else {
      this.key = key;
    }

    if (this.key.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${this.key.length}`);
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  public encrypt(data: string | Buffer, options: EncryptionOptions = {}): EncryptedData {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.key, iv);

    if (options.aad) {
      cipher.setAAD(options.aad);
    }

    const content = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      content: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  public decrypt(encrypted: EncryptedData, options: EncryptionOptions = {}): string {
    const iv = Buffer.from(encrypted.iv, 'base64');
    const content = Buffer.from(encrypted.content, 'base64');
    const tag = Buffer.from(encrypted.tag, 'base64');

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    if (options.aad) {
      decipher.setAAD(options.aad);
    }

    const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Encrypt data to a single base64 string (iv:content:tag)
   */
  public encryptToString(data: string | Buffer, options: EncryptionOptions = {}): string {
    const encrypted = this.encrypt(data, options);
    return `${encrypted.iv}:${encrypted.content}:${encrypted.tag}`;
  }

  /**
   * Decrypt data from a single base64 string
   */
  public decryptFromString(encryptedString: string, options: EncryptionOptions = {}): string {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted string format');
    }

    const [iv, content, tag] = parts;
    if (!iv || !content || !tag) {
      throw new Error('Invalid encrypted string format');
    }

    return this.decrypt({ iv, content, tag }, options);
  }
}

/**
 * Password-based encryptor using scrypt key derivation
 *
 * @example
 * ```typescript
 * const encryptor = new PasswordEncryptor('my-password');
 *
 * const encrypted = encryptor.encrypt('secret data');
 * const decrypted = encryptor.decrypt(encrypted);
 * ```
 */
export class PasswordEncryptor {
  private readonly password: string;

  constructor(password: string) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    this.password = password;
  }

  /**
   * Encrypt data using password-derived key
   */
  public encrypt(data: string | Buffer, options: EncryptionOptions = {}): EncryptedData {
    const salt = generateSalt();
    const key = deriveKey(this.password, salt);
    const encryptor = new Encryptor(key);

    const encrypted = encryptor.encrypt(data, options);
    encrypted.salt = salt.toString('base64');

    return encrypted;
  }

  /**
   * Decrypt data using password-derived key
   */
  public decrypt(encrypted: EncryptedData, options: EncryptionOptions = {}): string {
    if (!encrypted.salt) {
      throw new Error('Salt is required for password-based decryption');
    }

    const salt = Buffer.from(encrypted.salt, 'base64');
    const key = deriveKey(this.password, salt);
    const encryptor = new Encryptor(key);

    return encryptor.decrypt(encrypted, options);
  }
}

/**
 * Secure comparison to prevent timing attacks
 */
export function secureCompare(a: string | Buffer, b: string | Buffer): boolean {
  const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }

  return result === 0;
}

/**
 * Generate a secure random token
 */
export function generateToken(length = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Hash data using SHA-256
 */
export function hash(data: string | Buffer): string {
  const { createHash } = require('crypto') as typeof import('crypto');
  const hashFn = createHash('sha256');
  hashFn.update(Buffer.isBuffer(data) ? data : Buffer.from(data));
  return hashFn.digest('hex');
}
