// tests/index.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createLogger } from '../index';
import { transports } from 'winston';
import { Writable } from 'stream';

describe('Logger Factory', () => {
  let originalEnv: string | undefined;

  // Temporarily force production mode so createLogger outputs parseable JSON
  // while keeping all our custom formatting logic intact.
  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  function createTestLogger() {
    let logOutput: any = null;
    
    const captureStream = new Writable({
      write(chunk, encoding, callback) {
        logOutput = JSON.parse(chunk.toString());
        callback();
      }
    });

    const logger = createLogger({ 
      serviceName: 'test-service',
      customTransports: [
        new transports.Stream({ stream: captureStream })
      ] 
    });

    return { logger, getOutput: () => logOutput };
  }

  it('should redact default sensitive keys deeply', () => {
    const { logger, getOutput } = createTestLogger();

    logger.info('User login', { user: { email: 'a@b.com', password: 'secret123' } });
    
    const output = getOutput();
    expect(output.user.email).toBe('a@b.com');
    expect(output.user.password).toBe('[REDACTED]');
  });

  it('should gracefully handle circular dependencies', () => {
    const { logger, getOutput } = createTestLogger();

    const circularObj: any = { data: 'hello' };
    circularObj.self = circularObj;

    expect(() => logger.info('Circular Test', { obj: circularObj })).not.toThrow();
    
    const output = getOutput();
    expect(output.obj.self).toBe('[Circular]');
  });

  it('should preserve Error objects and undefined', () => {
    const { logger, getOutput } = createTestLogger();

    const testError = new Error('Database timeout');
    logger.error('Query failed', { err: testError, missingVal: undefined });

    const output = getOutput();
    expect(output.err.message).toBe('Database timeout');
    expect(output.err.stack).toBeDefined();
  });
});