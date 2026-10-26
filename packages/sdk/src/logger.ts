const PREFIX = "[errwise]";

export interface Logger {
  debug(message: string): void;
  warn(message: string): void;
}

/** warn always prints (misconfiguration must not be silent). debug only prints with debug: true. */
export function createLogger(debug: boolean): Logger {
  return {
    debug: (message) => {
      if (debug) console.debug(`${PREFIX} ${message}`);
    },
    warn: (message) => console.warn(`${PREFIX} ${message}`),
  };
}
