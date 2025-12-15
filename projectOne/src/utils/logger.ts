// Logger utility
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

class Logger {
  private formatLog(level: LogLevel, message: string, data?: unknown): LogEntry {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (data && typeof data === 'object') {
      logEntry.data = data as Record<string, unknown>;
    }

    return logEntry;
  }

  private output(entry: LogEntry): void {
    const logStr = JSON.stringify(entry);
    switch (entry.level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(logStr);
        break;
      case LogLevel.WARN:
        console.warn(logStr);
        break;
      case LogLevel.ERROR:
        console.error(logStr);
        break;
    }
  }

  debug(message: string, data?: unknown): void {
    this.output(this.formatLog(LogLevel.DEBUG, message, data));
  }

  info(message: string, data?: unknown): void {
    this.output(this.formatLog(LogLevel.INFO, message, data));
  }

  warn(message: string, data?: unknown): void {
    this.output(this.formatLog(LogLevel.WARN, message, data));
  }

  error(message: string, data?: unknown): void {
    this.output(this.formatLog(LogLevel.ERROR, message, data));
  }
}

export const logger = new Logger();
