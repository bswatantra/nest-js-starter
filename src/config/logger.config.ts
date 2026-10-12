import 'dotenv/config';
import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ConsoleLogger, type LogLevel } from '@nestjs/common';

export type LogChannel = 'stderr' | 'file' | 'stack';

export interface LoggerConfig {
  channel: LogChannel;
  writeToStderr: boolean;
  writeToFile: boolean;
  logFilePath: string;
  errorFilePath: string;
}

// Matches ANSI escape sequences so file logs remain clean plain text
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_REGEX = /\x1B\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(input: string): string {
  return input.replace(ANSI_ESCAPE_REGEX, '');
}

function resolveLogChannel(rawChannel: string | undefined): LogChannel {
  const normalized = rawChannel?.trim().toLowerCase();
  if (!normalized || normalized === 'stderr' || normalized === 'console') {
    return 'stderr';
  }
  if (normalized === 'file' || normalized === 'single') {
    return 'file';
  }
  if (
    normalized === 'stack' ||
    normalized === 'both' ||
    (normalized.includes('stderr') && normalized.includes('file'))
  ) {
    return 'stack';
  }
  return 'stderr';
}

export function getLoggerConfig(): LoggerConfig {
  const channel = resolveLogChannel(process.env['LOG_CHANNEL']);
  const logFilePath = resolve(
    process.cwd(),
    process.env['LOG_FILE'] ?? 'logs/app.log',
  );
  const errorFilePath = resolve(
    process.cwd(),
    process.env['LOG_ERROR_FILE'] ?? 'logs/error.log',
  );

  return {
    channel,
    writeToStderr: channel === 'stderr' || channel === 'stack',
    writeToFile: channel === 'file' || channel === 'stack',
    logFilePath,
    errorFilePath,
  };
}

export class AppLogger extends ConsoleLogger {
  private readonly loggerConfig: LoggerConfig;
  private readonly logFd: number | undefined;
  private readonly errorFd: number | undefined;

  constructor(config?: LoggerConfig) {
    const resolvedConfig = config ?? getLoggerConfig();
    super({
      colors: resolvedConfig.writeToStderr,
    });
    this.loggerConfig = resolvedConfig;

    if (this.loggerConfig.writeToFile) {
      mkdirSync(dirname(this.loggerConfig.logFilePath), { recursive: true });
      mkdirSync(dirname(this.loggerConfig.errorFilePath), { recursive: true });
      this.logFd = openSync(this.loggerConfig.logFilePath, 'a');
      this.errorFd = openSync(this.loggerConfig.errorFilePath, 'a');
    }
  }

  close(): void {
    if (this.logFd !== undefined) {
      closeSync(this.logFd);
    }
    if (this.errorFd !== undefined) {
      closeSync(this.errorFd);
    }
  }

  protected override printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    _writeStreamType?: 'stdout' | 'stderr',
    _errorStack?: unknown,
    params?: Record<string, unknown>,
  ): void {
    for (const message of messages) {
      const pidMessage = this.formatPid(process.pid);
      const contextMessage = this.formatContext(context);
      const timestampDiff = this.updateAndGetTimestampDiff();
      const formattedLogLevel = logLevel.toUpperCase().padStart(7, ' ');
      const formattedMessage = this.formatMessage(
        logLevel,
        message,
        pidMessage,
        formattedLogLevel,
        contextMessage,
        timestampDiff,
        params,
      );

      if (this.loggerConfig.writeToStderr) {
        process.stderr.write(formattedMessage);
      }

      if (this.loggerConfig.writeToFile && this.logFd !== undefined) {
        const plainMessage = this.loggerConfig.writeToStderr
          ? stripAnsi(formattedMessage)
          : formattedMessage;
        writeSync(this.logFd, plainMessage);

        if (
          (logLevel === 'error' || logLevel === 'fatal') &&
          this.errorFd !== undefined
        ) {
          writeSync(this.errorFd, plainMessage);
        }
      }
    }
  }

  protected override printStackTrace(stack: string): void {
    if (!stack) {
      return;
    }

    const formattedStack = `${stack}\n`;

    if (this.loggerConfig.writeToStderr) {
      process.stderr.write(formattedStack);
    }

    if (
      this.loggerConfig.writeToFile &&
      this.logFd !== undefined &&
      this.errorFd !== undefined
    ) {
      const plainStack = this.loggerConfig.writeToStderr
        ? stripAnsi(formattedStack)
        : formattedStack;
      writeSync(this.logFd, plainStack);
      writeSync(this.errorFd, plainStack);
    }
  }
}
