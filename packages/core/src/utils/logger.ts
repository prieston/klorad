/**
 * Centralized logger with compile-time flag support
 *
 * Uses compile-time constants for dead-code elimination:
 * - __DEV__: true in development, false in production (gets stripped)
 * - __LOG_LEVEL__: 'debug' | 'info' | 'warn' | 'error' | 'silent'
 * - DEBUG_SENSORS: true to enable verbose Cesium sensor logging
 *
 * In production builds, debug/info logs are completely eliminated by the minifier.
 */

// These will be replaced at compile time via DefinePlugin/webpack
// @ts-expect-error - Compile-time constants defined via webpack DefinePlugin
declare const __DEV__: boolean;
// @ts-expect-error - Compile-time constant
declare const __LOG_LEVEL__: "debug" | "info" | "warn" | "error" | "silent";
// @ts-expect-error - Compile-time constant
declare const DEBUG_SENSORS: boolean;

// Fallback for environments where constants aren't defined
const isDev =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV === "development";
const logLevel =
  typeof __LOG_LEVEL__ !== "undefined"
    ? __LOG_LEVEL__
    : isDev
      ? "debug"
      : "warn";
const debugSensors =
  typeof DEBUG_SENSORS !== "undefined" ? DEBUG_SENSORS : false;

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  sensors?: (...args: unknown[]) => void; // Optional logger for Cesium sensors
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function shouldLog(level: keyof typeof LOG_LEVELS): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[logLevel];
}

export function createLogger(prefix?: string): Logger {
  const format = (args: unknown[]) =>
    prefix ? [`[${prefix}]`, ...args] : args;

  const logger: Logger = {
    debug: (...args: unknown[]) => {
      if (isDev && shouldLog("debug")) {
        // eslint-disable-next-line no-console
        console.debug(...format(args));
      }
    },
    info: (...args: unknown[]) => {
      if (isDev && shouldLog("info")) {
        // eslint-disable-next-line no-console
        console.info(...format(args));
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) {
        // eslint-disable-next-line no-console
        console.warn(...format(args));
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) {
        // eslint-disable-next-line no-console
        console.error(...format(args));
      }
    },
  };

  // Only add sensors logger if DEBUG_SENSORS is enabled
  if (debugSensors) {
    logger.sensors = (...args: unknown[]) => {
      if (isDev && shouldLog("debug")) {
        // eslint-disable-next-line no-console
        console.debug("[SENSORS]", ...format(args));
      }
    };
  }

  return logger;
}

// Default logger instance
export const logger = createLogger();

// Export constants for type checking (will be replaced at compile time)
export const DEV = isDev;
export const LOG_LEVEL_CONSTANT = logLevel;
export const DEBUG_SENSORS_FLAG = debugSensors;
