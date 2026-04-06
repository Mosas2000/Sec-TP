import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetricsCollector } from '../src/collector.js';
import type { MetricsReporter, MetricsReport } from '../src/collector.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let mockReporter: MetricsReporter;

  beforeEach(() => {
    mockReporter = {
      name: 'mock',
      report: vi.fn().mockResolvedValue(undefined),
    };

    collector = new MetricsCollector({
      appName: 'test-app',
      autoFlush: false,
    });
    collector.addReporter(mockReporter);
  });

  afterEach(async () => {
    await collector.close();
  });

  describe('counter metrics', () => {
    it('should increment counter', async () => {
      collector.increment('requests');
      collector.increment('requests');
      collector.increment('requests', 3);

      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'requests',
              type: 'counter',
              sum: 5,
              count: 3,
            }),
          ]),
        })
      );
    });

    it('should decrement counter', async () => {
      collector.increment('balance', 100);
      collector.decrement('balance', 30);

      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'balance',
              sum: 70,
            }),
          ]),
        })
      );
    });

    it('should track counters with tags', async () => {
      collector.increment('requests', 1, { endpoint: '/users', method: 'GET' });
      collector.increment('requests', 1, { endpoint: '/users', method: 'POST' });

      await collector.flush();

      const report = (mockReporter.report as ReturnType<typeof vi.fn>).mock.calls[0][0] as MetricsReport;
      expect(report.metrics.length).toBe(2);
    });
  });

  describe('gauge metrics', () => {
    it('should set gauge value', async () => {
      collector.gauge('memory', 1024);
      collector.gauge('memory', 2048);
      collector.gauge('memory', 1536);

      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'memory',
              type: 'gauge',
              last: 1536,
              min: 1024,
              max: 2048,
            }),
          ]),
        })
      );
    });
  });

  describe('timing metrics', () => {
    it('should record timing values', async () => {
      collector.timing('api.latency', 100);
      collector.timing('api.latency', 200);
      collector.timing('api.latency', 150);

      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'api.latency',
              type: 'timing',
              count: 3,
              avg: 150,
              min: 100,
              max: 200,
            }),
          ]),
        })
      );
    });

    it('should time async operations', async () => {
      const result = await collector.time('operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'done';
      });

      expect(result).toBe('done');

      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'operation',
              type: 'timing',
            }),
          ]),
        })
      );
    });

    it('should record timing on failed operations', async () => {
      await expect(
        collector.time('failing', async () => {
          throw new Error('Failed');
        })
      ).rejects.toThrow('Failed');

      await collector.flush();

      const report = (mockReporter.report as ReturnType<typeof vi.fn>).mock.calls[0][0] as MetricsReport;
      const metric = report.metrics.find(m => m.name === 'failing');
      expect(metric?.tags?.success).toBe(false);
    });

    it('should provide manual timer', async () => {
      const stopTimer = collector.startTimer('manual');
      await new Promise(resolve => setTimeout(resolve, 50));
      const duration = stopTimer();

      expect(duration).toBeGreaterThanOrEqual(50);

      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'manual',
              type: 'timing',
            }),
          ]),
        })
      );
    });
  });

  describe('histogram metrics', () => {
    it('should record histogram values', async () => {
      collector.histogram('response.size', 100);
      collector.histogram('response.size', 500);
      collector.histogram('response.size', 250);

      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              name: 'response.size',
              type: 'histogram',
              min: 100,
              max: 500,
            }),
          ]),
        })
      );
    });
  });

  describe('default tags', () => {
    it('should include default tags in all metrics', async () => {
      const collectorWithTags = new MetricsCollector({
        autoFlush: false,
        defaultTags: { env: 'test', version: '1.0.0' },
      });
      collectorWithTags.addReporter(mockReporter);

      collectorWithTags.increment('requests');

      await collectorWithTags.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.arrayContaining([
            expect.objectContaining({
              tags: expect.objectContaining({
                env: 'test',
                version: '1.0.0',
              }),
            }),
          ]),
        })
      );

      await collectorWithTags.close();
    });
  });

  describe('buffer management', () => {
    it('should report buffer size', () => {
      collector.increment('test');
      collector.increment('test');
      
      expect(collector.getBufferSize()).toBe(2);
    });

    it('should clear buffer after flush', async () => {
      collector.increment('test');
      await collector.flush();
      
      expect(collector.getBufferSize()).toBe(0);
    });

    it('should auto-flush when buffer exceeds max size', async () => {
      const smallCollector = new MetricsCollector({
        autoFlush: false,
        maxBufferSize: 5,
      });
      smallCollector.addReporter(mockReporter);

      for (let i = 0; i < 6; i++) {
        smallCollector.increment(`metric-${i}`);
      }

      // Auto-flush should have been triggered
      expect(mockReporter.report).toHaveBeenCalled();

      await smallCollector.close();
    });
  });

  describe('reporters', () => {
    it('should add and remove reporters', () => {
      const reporter2: MetricsReporter = {
        name: 'reporter2',
        report: vi.fn().mockResolvedValue(undefined),
      };

      collector.addReporter(reporter2);
      collector.increment('test');

      collector.removeReporter(reporter2);
    });

    it('should handle reporter errors gracefully', async () => {
      const errorReporter: MetricsReporter = {
        name: 'error',
        report: vi.fn().mockRejectedValue(new Error('Reporter failed')),
      };

      collector.addReporter(errorReporter);
      collector.increment('test');

      // Should not throw
      await expect(collector.flush()).resolves.toBeUndefined();
    });
  });

  describe('reports', () => {
    it('should include app name in report', async () => {
      collector.increment('test');
      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          appName: 'test-app',
        })
      );
    });

    it('should include timestamp and period', async () => {
      collector.increment('test');
      await collector.flush();

      expect(mockReporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          period: expect.any(Number),
        })
      );
    });

    it('should not report empty buffer', async () => {
      await collector.flush();
      expect(mockReporter.report).not.toHaveBeenCalled();
    });
  });
});
