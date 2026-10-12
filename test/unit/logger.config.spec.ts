import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppLogger, getLoggerConfig } from '@/config/logger.config';

describe('Logger Configuration (stderr / file / stack)', () => {
  const originalEnv = { ...process.env };
  const testLogDir = resolve(process.cwd(), 'logs/.test-logs');

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['LOG_CHANNEL'];
    delete process.env['LOG_FILE'];
    delete process.env['LOG_ERROR_FILE'];
    rmSync(testLogDir, { recursive: true, force: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(testLogDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('defaults to stderr channel when LOG_CHANNEL is not set', () => {
    const config = getLoggerConfig();
    expect(config.channel).toBe('stderr');
    expect(config.writeToStderr).toBe(true);
    expect(config.writeToFile).toBe(false);
  });

  it('writes only to stderr when LOG_CHANNEL=stderr', () => {
    process.env['LOG_CHANNEL'] = 'stderr';
    process.env['LOG_FILE'] = 'logs/.test-logs/app.log';
    process.env['LOG_ERROR_FILE'] = 'logs/.test-logs/error.log';

    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const logger = new AppLogger();
    logger.log('Terminal log test', 'TestContext');

    expect(stderrSpy).toHaveBeenCalled();
    expect(existsSync(resolve(process.cwd(), 'logs/.test-logs/app.log'))).toBe(
      false,
    );
  });

  it('writes only to log files when LOG_CHANNEL=file', () => {
    process.env['LOG_CHANNEL'] = 'file';
    process.env['LOG_FILE'] = 'logs/.test-logs/app.log';
    process.env['LOG_ERROR_FILE'] = 'logs/.test-logs/error.log';

    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const logger = new AppLogger();
    logger.log('File info message', 'FileTest');
    logger.error('File error message', 'ErrorStack', 'FileTest');

    expect(stderrSpy).not.toHaveBeenCalled();

    const appLog = readFileSync(
      resolve(process.cwd(), 'logs/.test-logs/app.log'),
      'utf-8',
    );
    const errorLog = readFileSync(
      resolve(process.cwd(), 'logs/.test-logs/error.log'),
      'utf-8',
    );

    expect(appLog).toContain('File info message');
    expect(appLog).toContain('File error message');
    expect(errorLog).not.toContain('File info message');
    expect(errorLog).toContain('File error message');
  });

  it('writes to both stderr and log files when LOG_CHANNEL=stack', () => {
    process.env['LOG_CHANNEL'] = 'stack';
    process.env['LOG_FILE'] = 'logs/.test-logs/app.log';
    process.env['LOG_ERROR_FILE'] = 'logs/.test-logs/error.log';

    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const logger = new AppLogger();
    logger.log('Dual output message', 'StackTest');

    expect(stderrSpy).toHaveBeenCalled();
    const appLog = readFileSync(
      resolve(process.cwd(), 'logs/.test-logs/app.log'),
      'utf-8',
    );
    expect(appLog).toContain('Dual output message');
  });
});
