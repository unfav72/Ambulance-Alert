// Production structured logger with PII and credential redaction

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'jwt', 'secret', 'mfaSecret', 'authHeader'];

function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveData);

  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      cleaned[key] = redactSensitiveData(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

class Logger {
  private format(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const payload: any = {
      timestamp,
      level,
      message,
    };
    if (meta) {
      payload.meta = redactSensitiveData(meta);
    }
    return JSON.stringify(payload);
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format('DEBUG', message, meta));
    }
  }

  info(message: string, meta?: any) {
    console.info(this.format('INFO', message, meta));
  }

  warn(message: string, meta?: any) {
    console.warn(this.format('WARN', message, meta));
  }

  error(message: string, meta?: any) {
    console.error(this.format('ERROR', message, meta));
  }

  security(message: string, meta?: any) {
    console.warn(this.format('SECURITY', `[SECURITY ALERT] ${message}`, meta));
  }
}

export const logger = new Logger();
