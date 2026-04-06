import { createHmac, createSign, createVerify, randomBytes } from 'crypto';

/**
 * Supported signing algorithms
 */
export type SigningAlgorithm = 'HMAC-SHA256' | 'HMAC-SHA384' | 'HMAC-SHA512' | 'RSA-SHA256' | 'RSA-SHA384' | 'RSA-SHA512';

/**
 * Request data to be signed
 */
export interface SignableRequest {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Request body (stringified) */
  body?: string;
  /** Request timestamp */
  timestamp: number;
  /** Optional nonce for replay protection */
  nonce?: string;
}

/**
 * Signature result with metadata
 */
export interface SignatureResult {
  /** The signature value */
  signature: string;
  /** Algorithm used */
  algorithm: SigningAlgorithm;
  /** Timestamp when signed */
  timestamp: number;
  /** Nonce used (if any) */
  nonce?: string;
  /** Signature version */
  version: string;
}

/**
 * Request signer configuration
 */
export interface RequestSignerConfig {
  /** Signing algorithm */
  algorithm: SigningAlgorithm;
  /** Secret key for HMAC or private key for RSA (PEM format) */
  secret: string | Buffer;
  /** Public key for RSA verification (PEM format) */
  publicKey?: string | Buffer;
  /** Maximum age of signature in milliseconds (default: 5 minutes) */
  maxAge?: number;
  /** Include nonce in signature */
  includeNonce?: boolean;
}

/**
 * Default max age for signatures (5 minutes)
 */
const DEFAULT_MAX_AGE = 5 * 60 * 1000;

/**
 * Signature version
 */
const SIGNATURE_VERSION = 'v1';

/**
 * Request signer for creating and verifying request signatures
 *
 * @example
 * ```typescript
 * // HMAC signing
 * const signer = new RequestSigner({
 *   algorithm: 'HMAC-SHA256',
 *   secret: process.env.SIGNING_SECRET,
 * });
 *
 * const signature = signer.sign({
 *   method: 'POST',
 *   path: '/api/users',
 *   body: JSON.stringify({ name: 'John' }),
 *   timestamp: Date.now(),
 * });
 * ```
 */
export class RequestSigner {
  private readonly config: Required<Omit<RequestSignerConfig, 'publicKey'>> & { publicKey?: string | Buffer };

  constructor(config: RequestSignerConfig) {
    this.config = {
      algorithm: config.algorithm,
      secret: config.secret,
      publicKey: config.publicKey,
      maxAge: config.maxAge ?? DEFAULT_MAX_AGE,
      includeNonce: config.includeNonce ?? false,
    };

    this.validateConfig();
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.config.secret) {
      throw new Error('Secret is required for signing');
    }

    if (this.isRSA() && !this.config.publicKey) {
      throw new Error('Public key is required for RSA verification');
    }
  }

  /**
   * Check if using RSA algorithm
   */
  private isRSA(): boolean {
    return this.config.algorithm.startsWith('RSA-');
  }

  /**
   * Get the hash algorithm name
   */
  private getHashAlgorithm(): string {
    const algo = this.config.algorithm;
    if (algo.includes('256')) return 'sha256';
    if (algo.includes('384')) return 'sha384';
    if (algo.includes('512')) return 'sha512';
    return 'sha256';
  }

  /**
   * Build the string to sign
   */
  private buildSignatureBase(request: SignableRequest): string {
    const parts = [
      request.method.toUpperCase(),
      request.path,
      request.timestamp.toString(),
    ];

    if (request.nonce) {
      parts.push(request.nonce);
    }

    if (request.body) {
      parts.push(request.body);
    }

    return parts.join('\n');
  }

  /**
   * Sign a request
   */
  public sign(request: SignableRequest): string {
    const signRequest = { ...request };

    // Add nonce if configured
    if (this.config.includeNonce && !signRequest.nonce) {
      signRequest.nonce = randomBytes(16).toString('base64');
    }

    const signatureBase = this.buildSignatureBase(signRequest);
    let signature: string;

    if (this.isRSA()) {
      const sign = createSign(this.getHashAlgorithm());
      sign.update(signatureBase);
      signature = sign.sign(this.config.secret, 'base64');
    } else {
      const hmac = createHmac(this.getHashAlgorithm(), this.config.secret);
      hmac.update(signatureBase);
      signature = hmac.digest('base64');
    }

    return signature;
  }

  /**
   * Sign a request and return full result with metadata
   */
  public signWithMetadata(request: Omit<SignableRequest, 'timestamp' | 'nonce'>): SignatureResult {
    const timestamp = Date.now();
    const nonce = this.config.includeNonce ? randomBytes(16).toString('base64') : undefined;

    const fullRequest: SignableRequest = {
      ...request,
      timestamp,
      nonce,
    };

    const signature = this.sign(fullRequest);

    return {
      signature,
      algorithm: this.config.algorithm,
      timestamp,
      nonce,
      version: SIGNATURE_VERSION,
    };
  }

  /**
   * Verify a request signature
   */
  public verify(signature: string, request: SignableRequest): boolean {
    // Check timestamp age
    const age = Date.now() - request.timestamp;
    if (age > this.config.maxAge) {
      return false;
    }

    const signatureBase = this.buildSignatureBase(request);

    if (this.isRSA()) {
      if (!this.config.publicKey) {
        throw new Error('Public key required for RSA verification');
      }
      const verify = createVerify(this.getHashAlgorithm());
      verify.update(signatureBase);
      return verify.verify(this.config.publicKey, signature, 'base64');
    } else {
      const expectedSignature = this.sign(request);
      return this.secureCompare(signature, expectedSignature);
    }
  }

  /**
   * Timing-safe comparison
   */
  private secureCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

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
   * Create signature header value
   */
  public createAuthorizationHeader(result: SignatureResult): string {
    const parts = [
      `${result.version}`,
      `alg=${result.algorithm}`,
      `ts=${result.timestamp}`,
      `sig=${result.signature}`,
    ];

    if (result.nonce) {
      parts.push(`nonce=${result.nonce}`);
    }

    return `TipStream ${parts.join(', ')}`;
  }

  /**
   * Parse signature from authorization header
   */
  public static parseAuthorizationHeader(header: string): SignatureResult | null {
    if (!header.startsWith('TipStream ')) {
      return null;
    }

    const content = header.slice('TipStream '.length);
    const parts = content.split(', ');

    const result: Partial<SignatureResult> = {};

    for (const part of parts) {
      if (part.startsWith('v')) {
        result.version = part;
      } else {
        const [key, value] = part.split('=');
        switch (key) {
          case 'alg':
            result.algorithm = value as SigningAlgorithm;
            break;
          case 'ts':
            result.timestamp = parseInt(value ?? '0', 10);
            break;
          case 'sig':
            result.signature = value;
            break;
          case 'nonce':
            result.nonce = value;
            break;
        }
      }
    }

    if (!result.signature || !result.algorithm || !result.timestamp || !result.version) {
      return null;
    }

    return result as SignatureResult;
  }
}

/**
 * Webhook signature verifier for incoming webhooks
 */
export class WebhookVerifier {
  private readonly secret: string | Buffer;
  private readonly maxAge: number;

  constructor(secret: string | Buffer, maxAge = DEFAULT_MAX_AGE) {
    this.secret = secret;
    this.maxAge = maxAge;
  }

  /**
   * Verify a webhook signature
   */
  public verify(payload: string | Buffer, signature: string, timestamp: number): boolean {
    // Check timestamp age
    const age = Date.now() - timestamp;
    if (age > this.maxAge) {
      return false;
    }

    const payloadStr = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    const signatureBase = `${timestamp}.${payloadStr}`;

    const hmac = createHmac('sha256', this.secret);
    hmac.update(signatureBase);
    const expectedSignature = hmac.digest('hex');

    return this.secureCompare(signature, expectedSignature);
  }

  /**
   * Generate a webhook signature (for testing)
   */
  public generateSignature(payload: string | Buffer, timestamp: number): string {
    const payloadStr = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    const signatureBase = `${timestamp}.${payloadStr}`;

    const hmac = createHmac('sha256', this.secret);
    hmac.update(signatureBase);
    return hmac.digest('hex');
  }

  /**
   * Timing-safe comparison
   */
  private secureCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
      result |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
    }

    return result === 0;
  }
}
