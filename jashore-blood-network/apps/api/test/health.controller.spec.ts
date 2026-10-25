import { describe, it, expect } from 'vitest';
import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  it('returns ok status with service metadata', () => {
    const controller = new HealthController();
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('jashore-blood-network-api');
    expect(result.version).toBe('0.1.0');
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    // ISO 8601 timestamp should be parseable
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
