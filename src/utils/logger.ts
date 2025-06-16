export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}


class Logger {
  private logLevel: LogLevel;

  constructor(logLevel?: LogLevel | string) {
    if (typeof logLevel === 'string') {
      this.logLevel = LogLevel[logLevel.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO;
    } else {
      this.logLevel = logLevel ?? LogLevel.INFO;
    }
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level > this.logLevel) {
      return;
    }

    const timestamp = new Date();
    const levelName = LogLevel[level];
    const logMessage = `[${timestamp.toISOString()}] ${levelName}: ${message}`;

    switch (level) {
      case LogLevel.ERROR:
        if (data) {
          console.error(logMessage, data);
        } else {
          console.error(logMessage);
        }
        break;
      case LogLevel.WARN:
        if (data) {
          console.warn(logMessage, data);
        } else {
          console.warn(logMessage);
        }
        break;
      case LogLevel.INFO:
        if (data) {
          console.info(logMessage, data);
        } else {
          console.info(logMessage);
        }
        break;
      case LogLevel.DEBUG:
        if (data) {
          console.debug(logMessage, data);
        } else {
          console.debug(logMessage);
        }
        break;
    }
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }
}

export const logger = new Logger(LogLevel.WARN);