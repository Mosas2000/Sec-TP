/**
 * Validation field types
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'url' | 'uuid' | 'date';

/**
 * Field validation schema
 */
export interface FieldSchema {
  /** Field type */
  type: FieldType;
  /** Whether the field is required */
  required?: boolean;
  /** Minimum value (for numbers) or length (for strings/arrays) */
  min?: number;
  /** Maximum value (for numbers) or length (for strings/arrays) */
  max?: number;
  /** Minimum length for strings */
  minLength?: number;
  /** Maximum length for strings */
  maxLength?: number;
  /** Regex pattern for strings */
  pattern?: string | RegExp;
  /** Predefined pattern name */
  format?: 'email' | 'url' | 'uuid' | 'alphanumeric' | 'slug' | 'phone';
  /** Allowed values (enum) */
  enum?: readonly (string | number | boolean)[];
  /** Custom validation function */
  custom?: (value: unknown) => boolean | string;
  /** Nested schema for objects */
  properties?: Schema;
  /** Schema for array items */
  items?: FieldSchema;
  /** Default value if not provided */
  default?: unknown;
  /** Field description for error messages */
  description?: string;
}

/**
 * Validation schema
 */
export interface Schema {
  [field: string]: FieldSchema;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Field path (e.g., "user.email") */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Actual value that failed validation */
  value?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validated and coerced data */
  data?: Record<string, unknown>;
}

/**
 * Predefined regex patterns
 */
const PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  phone: /^\+?[1-9]\d{1,14}$/,
} as const;

/**
 * Validate data against a schema
 */
export function validate(data: unknown, schema: Schema): ValidationResult {
  const errors: ValidationError[] = [];
  const validatedData: Record<string, unknown> = {};

  if (typeof data !== 'object' || data === null) {
    return {
      valid: false,
      errors: [{ field: '', message: 'Data must be an object', code: 'INVALID_TYPE' }],
    };
  }

  const inputData = data as Record<string, unknown>;

  for (const [field, fieldSchema] of Object.entries(schema)) {
    const value = inputData[field];
    const fieldErrors = validateField(value, fieldSchema, field);

    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors);
    } else if (value !== undefined) {
      validatedData[field] = value;
    } else if (fieldSchema.default !== undefined) {
      validatedData[field] = fieldSchema.default;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? validatedData : undefined,
  };
}

/**
 * Validate a single field
 */
function validateField(value: unknown, schema: FieldSchema, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check required
  if (value === undefined || value === null) {
    if (schema.required) {
      errors.push({
        field: path,
        message: `${schema.description ?? path} is required`,
        code: 'REQUIRED',
      });
    }
    return errors;
  }

  // Type validation
  const typeError = validateType(value, schema.type, path);
  if (typeError) {
    errors.push(typeError);
    return errors;
  }

  // String validations
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        field: path,
        message: `${schema.description ?? path} must be at least ${schema.minLength} characters`,
        code: 'MIN_LENGTH',
        value,
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        field: path,
        message: `${schema.description ?? path} must be at most ${schema.maxLength} characters`,
        code: 'MAX_LENGTH',
        value,
      });
    }
    if (schema.pattern) {
      const regex = typeof schema.pattern === 'string' ? new RegExp(schema.pattern) : schema.pattern;
      if (!regex.test(value)) {
        errors.push({
          field: path,
          message: `${schema.description ?? path} has invalid format`,
          code: 'INVALID_PATTERN',
          value,
        });
      }
    }
    if (schema.format) {
      const pattern = PATTERNS[schema.format];
      if (pattern && !pattern.test(value)) {
        errors.push({
          field: path,
          message: `${schema.description ?? path} must be a valid ${schema.format}`,
          code: 'INVALID_FORMAT',
          value,
        });
      }
    }
  }

  // Number validations
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      errors.push({
        field: path,
        message: `${schema.description ?? path} must be at least ${schema.min}`,
        code: 'MIN_VALUE',
        value,
      });
    }
    if (schema.max !== undefined && value > schema.max) {
      errors.push({
        field: path,
        message: `${schema.description ?? path} must be at most ${schema.max}`,
        code: 'MAX_VALUE',
        value,
      });
    }
  }

  // Array validations
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.min !== undefined && value.length < schema.min) {
      errors.push({
        field: path,
        message: `${schema.description ?? path} must have at least ${schema.min} items`,
        code: 'MIN_ITEMS',
        value,
      });
    }
    if (schema.max !== undefined && value.length > schema.max) {
      errors.push({
        field: path,
        message: `${schema.description ?? path} must have at most ${schema.max} items`,
        code: 'MAX_ITEMS',
        value,
      });
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemErrors = validateField(value[i], schema.items, `${path}[${i}]`);
        errors.push(...itemErrors);
      }
    }
  }

  // Object validations
  if (schema.type === 'object' && schema.properties && typeof value === 'object' && value !== null) {
    const result = validate(value, schema.properties);
    for (const error of result.errors) {
      errors.push({
        ...error,
        field: `${path}.${error.field}`,
      });
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value as string | number | boolean)) {
    errors.push({
      field: path,
      message: `${schema.description ?? path} must be one of: ${schema.enum.join(', ')}`,
      code: 'INVALID_ENUM',
      value,
    });
  }

  // Custom validation
  if (schema.custom) {
    const result = schema.custom(value);
    if (result !== true) {
      errors.push({
        field: path,
        message: typeof result === 'string' ? result : `${schema.description ?? path} failed custom validation`,
        code: 'CUSTOM_VALIDATION',
        value,
      });
    }
  }

  return errors;
}

/**
 * Validate value type
 */
function validateType(value: unknown, type: FieldType, path: string): ValidationError | null {
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return { field: path, message: `${path} must be a string`, code: 'INVALID_TYPE', value };
      }
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { field: path, message: `${path} must be a number`, code: 'INVALID_TYPE', value };
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { field: path, message: `${path} must be a boolean`, code: 'INVALID_TYPE', value };
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        return { field: path, message: `${path} must be an array`, code: 'INVALID_TYPE', value };
      }
      break;
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { field: path, message: `${path} must be an object`, code: 'INVALID_TYPE', value };
      }
      break;
    case 'email':
      if (typeof value !== 'string' || !PATTERNS.email.test(value)) {
        return { field: path, message: `${path} must be a valid email`, code: 'INVALID_EMAIL', value };
      }
      break;
    case 'url':
      if (typeof value !== 'string' || !PATTERNS.url.test(value)) {
        return { field: path, message: `${path} must be a valid URL`, code: 'INVALID_URL', value };
      }
      break;
    case 'uuid':
      if (typeof value !== 'string' || !PATTERNS.uuid.test(value)) {
        return { field: path, message: `${path} must be a valid UUID`, code: 'INVALID_UUID', value };
      }
      break;
    case 'date':
      if (!(value instanceof Date) && (typeof value !== 'string' || isNaN(Date.parse(value)))) {
        return { field: path, message: `${path} must be a valid date`, code: 'INVALID_DATE', value };
      }
      break;
  }
  return null;
}

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  /** Remove HTML tags */
  stripHtml?: boolean;
  /** Escape HTML entities */
  escapeHtml?: boolean;
  /** Trim whitespace */
  trim?: boolean;
  /** Convert to lowercase */
  lowercase?: boolean;
  /** Remove null bytes */
  removeNullBytes?: boolean;
  /** Maximum string length */
  maxLength?: number;
  /** Allowed HTML tags (if not stripping all) */
  allowedTags?: string[];
}

/**
 * HTML entity map for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Sanitize a string value
 */
export function sanitize(value: string, options: SanitizeOptions = {}): string {
  let result = value;

  // Remove null bytes
  if (options.removeNullBytes !== false) {
    result = result.replace(/\0/g, '');
  }

  // Strip HTML tags
  if (options.stripHtml) {
    if (options.allowedTags && options.allowedTags.length > 0) {
      const allowedPattern = options.allowedTags.join('|');
      const regex = new RegExp(`<(?!\/?(${allowedPattern})\s*\/?)[^>]+>`, 'gi');
      result = result.replace(regex, '');
    } else {
      result = result.replace(/<[^>]*>/g, '');
    }
  }

  // Escape HTML entities
  if (options.escapeHtml) {
    result = result.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] ?? char);
  }

  // Trim whitespace
  if (options.trim !== false) {
    result = result.trim();
  }

  // Convert to lowercase
  if (options.lowercase) {
    result = result.toLowerCase();
  }

  // Truncate to max length
  if (options.maxLength && result.length > options.maxLength) {
    result = result.substring(0, options.maxLength);
  }

  return result;
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: SanitizeOptions = {}
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitize(value, options);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string'
          ? sanitize(item, options)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, options)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Check for potential SQL injection patterns
 */
export function hasSqlInjection(value: string): boolean {
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(--)|(\/\*)|(\*\/)/,
    /(;|\||`)/,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    /(\bAND\b\s+\d+\s*=\s*\d+)/i,
  ];

  return patterns.some(pattern => pattern.test(value));
}

/**
 * Check for potential path traversal patterns
 */
export function hasPathTraversal(value: string): boolean {
  const patterns = [
    /\.\.\//,
    /\.\.\\/, 
    /%2e%2e%2f/i,
    /%2e%2e\//i,
    /\.\.%2f/i,
    /%2e%2e%5c/i,
  ];

  return patterns.some(pattern => pattern.test(value));
}

/**
 * Check for potential XSS patterns
 */
export function hasXss(value: string): boolean {
  const patterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<\s*img[^>]+onerror/gi,
    /<\s*svg[^>]+onload/gi,
  ];

  return patterns.some(pattern => pattern.test(value));
}
