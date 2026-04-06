import { describe, it, expect } from 'vitest';
import {
  Encryptor,
  PasswordEncryptor,
  generateKey,
  generateSalt,
  deriveKey,
  generateToken,
  hash,
  secureCompare,
} from '../src/encryption.js';

describe('Encryption utilities', () => {
  describe('generateKey', () => {
    it('should generate a 32-byte key', () => {
      const key = generateKey();
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('generateSalt', () => {
    it('should generate a 16-byte salt', () => {
      const salt = generateSalt();
      expect(salt.length).toBe(16);
    });
  });

  describe('deriveKey', () => {
    it('should derive consistent keys from same password and salt', () => {
      const salt = generateSalt();
      const key1 = deriveKey('password123', salt);
      const key2 = deriveKey('password123', salt);
      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys for different passwords', () => {
      const salt = generateSalt();
      const key1 = deriveKey('password123', salt);
      const key2 = deriveKey('password456', salt);
      expect(key1.equals(key2)).toBe(false);
    });

    it('should derive different keys for different salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const key1 = deriveKey('password123', salt1);
      const key2 = deriveKey('password123', salt2);
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('Encryptor', () => {
    it('should encrypt and decrypt string data', () => {
      const key = generateKey();
      const encryptor = new Encryptor(key);
      
      const plaintext = 'Hello, World!';
      const encrypted = encryptor.encrypt(plaintext);
      const decrypted = encryptor.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt Buffer data', () => {
      const key = generateKey();
      const encryptor = new Encryptor(key);
      
      const plaintext = Buffer.from('Binary data');
      const encrypted = encryptor.encrypt(plaintext);
      const decrypted = encryptor.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext.toString('utf8'));
    });

    it('should produce different ciphertext for same plaintext', () => {
      const key = generateKey();
      const encryptor = new Encryptor(key);
      
      const plaintext = 'Same message';
      const encrypted1 = encryptor.encrypt(plaintext);
      const encrypted2 = encryptor.encrypt(plaintext);
      
      expect(encrypted1.content).not.toBe(encrypted2.content);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should encrypt and decrypt with AAD', () => {
      const key = generateKey();
      const encryptor = new Encryptor(key);
      const aad = Buffer.from('additional authenticated data');
      
      const plaintext = 'Secret message';
      const encrypted = encryptor.encrypt(plaintext, { aad });
      const decrypted = encryptor.decrypt(encrypted, { aad });
      
      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong AAD', () => {
      const key = generateKey();
      const encryptor = new Encryptor(key);
      
      const plaintext = 'Secret message';
      const encrypted = encryptor.encrypt(plaintext, { aad: Buffer.from('correct') });
      
      expect(() => 
        encryptor.decrypt(encrypted, { aad: Buffer.from('wrong') })
      ).toThrow();
    });

    it('should encrypt/decrypt using string format', () => {
      const key = generateKey();
      const encryptor = new Encryptor(key);
      
      const plaintext = 'Test data';
      const encryptedStr = encryptor.encryptToString(plaintext);
      const decrypted = encryptor.decryptFromString(encryptedStr);
      
      expect(decrypted).toBe(plaintext);
      expect(encryptedStr.split(':').length).toBe(3);
    });

    it('should accept base64 encoded key', () => {
      const key = generateKey();
      const keyBase64 = key.toString('base64');
      
      const encryptor = new Encryptor(keyBase64);
      const plaintext = 'Test';
      const encrypted = encryptor.encrypt(plaintext);
      
      expect(encryptor.decrypt(encrypted)).toBe(plaintext);
    });

    it('should throw on invalid key length', () => {
      expect(() => new Encryptor(Buffer.from('short'))).toThrow('Invalid key length');
    });
  });

  describe('PasswordEncryptor', () => {
    it('should encrypt and decrypt with password', () => {
      const encryptor = new PasswordEncryptor('SecurePassword123');
      
      const plaintext = 'Secret data';
      const encrypted = encryptor.encrypt(plaintext);
      const decrypted = encryptor.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
      expect(encrypted.salt).toBeDefined();
    });

    it('should produce different ciphertext with same password', () => {
      const encryptor = new PasswordEncryptor('SecurePassword123');
      
      const plaintext = 'Same message';
      const encrypted1 = encryptor.encrypt(plaintext);
      const encrypted2 = encryptor.encrypt(plaintext);
      
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.content).not.toBe(encrypted2.content);
    });

    it('should throw on short password', () => {
      expect(() => new PasswordEncryptor('short')).toThrow('Password must be at least 8 characters');
    });

    it('should throw when salt is missing for decryption', () => {
      const encryptor = new PasswordEncryptor('SecurePassword123');
      
      expect(() => encryptor.decrypt({
        iv: 'test',
        content: 'test',
        tag: 'test',
      })).toThrow('Salt is required');
    });
  });

  describe('secureCompare', () => {
    it('should return true for equal strings', () => {
      expect(secureCompare('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('hello', 'world')).toBe(false);
    });

    it('should return false for different lengths', () => {
      expect(secureCompare('short', 'longer string')).toBe(false);
    });

    it('should work with buffers', () => {
      const a = Buffer.from('test');
      const b = Buffer.from('test');
      expect(secureCompare(a, b)).toBe(true);
    });
  });

  describe('generateToken', () => {
    it('should generate token of default length', () => {
      const token = generateToken();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate URL-safe tokens', () => {
      const token = generateToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('hash', () => {
    it('should produce consistent hash for same input', () => {
      const hash1 = hash('test data');
      const hash2 = hash('test data');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = hash('test1');
      const hash2 = hash('test2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex hash', () => {
      const result = hash('anything');
      expect(result.length).toBe(64);
      expect(result).toMatch(/^[a-f0-9]+$/);
    });
  });
});
