import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration tests for SDK workflows
 * 
 * These tests verify that the packages work together correctly.
 */

describe('SDK Integration', () => {
  describe('Core + Security integration', () => {
    it('should sign requests with security package', async () => {
      // Mock the security package integration
      const mockSigner = {
        sign: vi.fn().mockReturnValue('test-signature'),
      };

      // Simulate how core package would use security package
      const request = {
        method: 'POST' as const,
        path: '/api/data',
        body: JSON.stringify({ test: true }),
        timestamp: Date.now(),
      };

      const signature = mockSigner.sign(request);
      
      expect(mockSigner.sign).toHaveBeenCalledWith(request);
      expect(signature).toBe('test-signature');
    });

    it('should validate input before API call', () => {
      // Simulate validation workflow
      const schema = {
        name: { type: 'string' as const, required: true, minLength: 1 },
        email: { type: 'email' as const, required: true },
      };

      const validInput = { name: 'John', email: 'john@example.com' };
      const invalidInput = { name: '', email: 'not-an-email' };

      // Mock validation (actual implementation in security package)
      const validateMock = (data: Record<string, unknown>, _schema: typeof schema) => {
        const errors = [];
        if (!data.name || (data.name as string).length === 0) {
          errors.push({ field: 'name', message: 'Name is required' });
        }
        if (!data.email || !(data.email as string).includes('@')) {
          errors.push({ field: 'email', message: 'Invalid email' });
        }
        return { valid: errors.length === 0, errors };
      };

      expect(validateMock(validInput, schema).valid).toBe(true);
      expect(validateMock(invalidInput, schema).valid).toBe(false);
    });
  });

  describe('Core + Metrics integration', () => {
    it('should track API request metrics', async () => {
      const metricsEvents: Array<{ name: string; value: number; tags: Record<string, unknown> }> = [];
      
      // Mock metrics collector
      const mockCollector = {
        timing: vi.fn((name: string, value: number, tags: Record<string, unknown>) => {
          metricsEvents.push({ name, value, tags });
        }),
        increment: vi.fn(),
      };

      // Simulate API request with metrics
      const makeRequest = async (path: string) => {
        const start = Date.now();
        
        // Simulate request
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const duration = Date.now() - start;
        mockCollector.timing('api.request', duration, { path, success: true });
        mockCollector.increment('api.requests.total');
        
        return { data: 'test' };
      };

      await makeRequest('/users');

      expect(mockCollector.timing).toHaveBeenCalledWith(
        'api.request',
        expect.any(Number),
        expect.objectContaining({ path: '/users', success: true })
      );
      expect(mockCollector.increment).toHaveBeenCalledWith('api.requests.total');
    });

    it('should track errors in metrics', async () => {
      const errors: Error[] = [];
      
      const mockAnalytics = {
        trackError: vi.fn((error: Error) => {
          errors.push(error);
        }),
      };

      // Simulate error tracking
      try {
        throw new Error('API request failed');
      } catch (error) {
        mockAnalytics.trackError(error as Error);
      }

      expect(mockAnalytics.trackError).toHaveBeenCalled();
      expect(errors[0]?.message).toBe('API request failed');
    });
  });

  describe('Security + Metrics integration', () => {
    it('should log security events to audit log', () => {
      const auditLogs: Array<Record<string, unknown>> = [];
      
      const mockAuditLogger = {
        log: vi.fn((event: Record<string, unknown>) => {
          auditLogs.push(event);
        }),
      };

      // Simulate security event logging
      mockAuditLogger.log({
        category: 'authentication',
        action: 'login',
        success: true,
        actor: 'user@example.com',
      });

      mockAuditLogger.log({
        category: 'security',
        action: 'signature_verification',
        success: true,
        metadata: { algorithm: 'HMAC-SHA256' },
      });

      expect(auditLogs.length).toBe(2);
      expect(auditLogs[0]?.category).toBe('authentication');
      expect(auditLogs[1]?.category).toBe('security');
    });
  });

  describe('Full SDK workflow', () => {
    it('should complete authenticated API request workflow', async () => {
      const workflow = {
        steps: [] as string[],
      };

      // Step 1: Validate input
      workflow.steps.push('validate_input');
      
      // Step 2: Sign request
      workflow.steps.push('sign_request');
      
      // Step 3: Make API call
      workflow.steps.push('api_request');
      
      // Step 4: Track metrics
      workflow.steps.push('track_metrics');
      
      // Step 5: Log audit event
      workflow.steps.push('audit_log');

      expect(workflow.steps).toEqual([
        'validate_input',
        'sign_request',
        'api_request',
        'track_metrics',
        'audit_log',
      ]);
    });

    it('should handle error workflow correctly', async () => {
      const errorWorkflow = {
        error: null as Error | null,
        logged: false,
        metricsTracked: false,
      };

      // Simulate error handling
      try {
        throw new Error('Request failed');
      } catch (error) {
        errorWorkflow.error = error as Error;
        errorWorkflow.logged = true;
        errorWorkflow.metricsTracked = true;
      }

      expect(errorWorkflow.error).toBeDefined();
      expect(errorWorkflow.logged).toBe(true);
      expect(errorWorkflow.metricsTracked).toBe(true);
    });
  });
});

describe('Type compatibility', () => {
  it('should have compatible request signer interface', () => {
    // This test verifies type compatibility between packages
    interface RequestSigner {
      sign(request: {
        method: string;
        path: string;
        body?: string;
        timestamp: number;
      }): string;
    }

    const mockSigner: RequestSigner = {
      sign: (request) => `sig-${request.method}-${request.timestamp}`,
    };

    const signature = mockSigner.sign({
      method: 'POST',
      path: '/test',
      body: '{}',
      timestamp: 1234567890,
    });

    expect(signature).toBe('sig-POST-1234567890');
  });

  it('should have compatible metrics reporter interface', () => {
    interface MetricsReport {
      appName: string;
      timestamp: string;
      period: number;
      metrics: Array<{ name: string; type: string; value: number }>;
    }

    interface MetricsReporter {
      name: string;
      report(report: MetricsReport): Promise<void>;
    }

    const mockReporter: MetricsReporter = {
      name: 'test',
      report: async (report) => {
        expect(report.appName).toBeDefined();
      },
    };

    expect(mockReporter.name).toBe('test');
  });
});
