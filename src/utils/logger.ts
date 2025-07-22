import { Logger } from '../types.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFormat = 'json' | 'text';

class ConsoleLogger implements Logger {
  private level: LogLevel;
  private format: LogFormat;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(level: LogLevel = 'info', format: LogFormat = 'json') {
    this.level = level;
    this.format = format;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    
    if (this.format === 'json') {
      const logEntry = {
        timestamp,
        level,
        message,
        ...(meta && { meta }),
      };
      return JSON.stringify(logEntry);
    } else {
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    }
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);
    
    switch (level) {
      case 'debug':
      case 'info':
        console.log(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }
}

export function createLogger(): Logger {
  const level = (process.env['LOG_LEVEL'] as LogLevel) || 'info';
  const format = (process.env['LOG_FORMAT'] as LogFormat) || 'json';
  
  return new ConsoleLogger(level, format);
}

export { Logger, LogLevel, LogFormat };