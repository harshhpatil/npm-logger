import winston, { format, transports, Logger } from "winston";

// LoggerOptions interface - defines the configuration options for the logger
export interface LoggerOptions {
  serviceName: string;
  level?: string;
  redactKeys?: string[];
}

// Custom log format to automatically redact sensitive information from logs
const redactLog = format((info, opts: any) => {
  const keysToRedact = opts.keys || [
    "password",
    "secret",
    "token",
    "authorization",
  ];

  const traverseAndRedact = (obj: any) => {
    for (const key in obj) {
      if (keysToRedact.includes(key.toLowerCase())) {
        obj[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        traverseAndRedact(obj[key]);
      }
    }
  };

  const infoCopy = JSON.parse(JSON.stringify(info));
  traverseAndRedact(infoCopy);
  return infoCopy;
});

export function createLogger(options: LoggerOptions): Logger {
  const {
    serviceName,
    level = "info",
    redactKeys = ["password", "token", "secret", "jwt"],
  } = options;

  const isProduction = process.env.NODE_ENV === "production";

  return winston.createLogger({
    level: process.env.LOG_LEVEL || level,
    defaultMeta: { service: serviceName },
    format: format.combine(
      redactLog({ keys: redactKeys }),
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      format.errors({ stack: true }),
      isProduction
        ? format.json()
        : format.combine(format.colorize(), format.simple()),
    ),
    transports: [new transports.Console()],
  });
}
