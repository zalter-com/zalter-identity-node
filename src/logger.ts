const LOG_LEVELS = {
  VERBOSE: 1,
  DEBUG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5
};

interface LoggerConfig {
  level?: number;
}

export class Logger {
  /** The logger name */
  readonly #name;

  /** The logger level */
  readonly #level;

  constructor(name?: string, config?: LoggerConfig) {
    this.#name = name;

    if (config?.level) {
      this.#level = config.level;
    } else {
      this.#level = LOG_LEVELS.VERBOSE;
    }
  }

  #write(type: string, ...args) {
    if (LOG_LEVELS[type] < this.#level) {
      return;
    }

    let fn = console.log.bind(console);
    let color = '\x1b[94m';

    if (type === 'ERROR') {
      fn = console.error.bind(console);
      color = '\x1b[31m';
    }

    if (type === 'WARN') {
      fn = console.warn.bind(console);
      color = '\x1b[33m';
    }

    let prefix = `${new Date().toJSON()} ${color}${type}\x1b[0m`;

    if (this.#name) {
      prefix += ` [${this.#name}]`;
    }

    fn(prefix, ...args);
  }

  verbose(...args) {
    this.#write('VERBOSE', ...args);
  }

  debug(...args) {
    this.#write('DEBUG', ...args);
  }

  info(...args) {
    this.#write('INFO', ...args);
  }

  warn(...args) {
    this.#write('WARN', ...args);
  }

  error(...args) {
    this.#write('ERROR', ...args);
  }
}

export const logger = new Logger();