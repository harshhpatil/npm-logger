import winston, { format, transports, Logger } from "winston";

/**
 * Configuration used to create a Winston logger.
 */
export interface LoggerOptions {
  /** Service name attached to every log entry as `service`. */
  serviceName: string;
  /** Minimum severity to emit when `LOG_LEVEL` is not set. Defaults to `"info"`. */
  level?: string;
  /** Case-insensitive property names whose values should be replaced with `[REDACTED]`. */
  redactKeys?: string[];
  /** Whether to suppress all log output. Defaults to `false`. */
  silent?: boolean;
  /** Winston transports to use instead of the default console transport. */
  customTransports?: winston.transport[];
}

/**
 * Produces a safe, serializable copy of a value for logging.
 *
 * Object properties matching a configured redaction key are masked, `Error`
 * instances are converted to plain objects, and circular references are
 * represented as `"[Circular]"`.
 *
 * @param obj - Value to clean before it is logged.
 * @param keysToRedact - Lowercase property names that must be masked.
 * @param seen - Objects visited during the current traversal.
 * @returns A cleaned copy of the supplied value.
 */
function safeDeepCleanAndRedact(
  obj: any,
  keysToRedact: string[],
  seen = new WeakSet(),
): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (seen.has(obj)) {
    return "[Circular]";
  }
  seen.add(obj);

  if (obj instanceof Error) {
    const errorCopy: any = {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
    };
    return errorCopy;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => safeDeepCleanAndRedact(item, keysToRedact, seen));
  }

  const copy: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (keysToRedact.includes(key.toLowerCase())) {
        copy[key] = "[REDACTED]";
      } else {
        copy[key] = safeDeepCleanAndRedact(obj[key], keysToRedact, seen);
      }
    }
  }
  return copy;
}

/**
 * Winston format that redacts configured sensitive fields while preserving
 * Winston's symbol-based metadata.
 */
const redactLog = format((info, opts: any) => {
  const keysToRedact = (opts.keys || []).map((k: string) =>
    k.toLocaleLowerCase(),
  );
  const redactedInfo = safeDeepCleanAndRedact(info, keysToRedact);

  const symbols = Object.getOwnPropertySymbols(info);
  for (const sym of symbols) {
    redactedInfo[sym] = info[sym as keyof typeof info];
  }

  return redactedInfo;
});

/**
 * Creates a configured Winston logger with timestamps, error stacks, and
 * recursive sensitive-data redaction.
 *
 * Development logs are colorized and human-readable; production logs use JSON.
 * The `LOG_LEVEL` environment variable takes precedence over `options.level`.
 *
 * @param options - Logger configuration, including the required service name.
 * @returns A ready-to-use Winston logger.
 */
export function createLogger(options: LoggerOptions): Logger {
  const {
    serviceName,
    level = "info",
    redactKeys = ["password", "token", "secret", "jwt", "authorization"],
    silent = false,
    customTransports,
  } = options;

  const isProduction = process.env.NODE_ENV === "production";

  const baseTransports = customTransports || [new transports.Console()];

  return winston.createLogger({
    level: process.env.LOG_LEVEL || level,
    silent,
    defaultMeta: { service: serviceName },
    format: format.combine(
      redactLog({ keys: redactKeys }),
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      format.errors({ stack: true }),
      isProduction
        ? format.json()
        : format.combine(format.colorize(), format.simple()),
    ),
    transports: baseTransports,
  });
}
