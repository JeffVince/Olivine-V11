import winston from 'winston'

type Meta = unknown

const isTest = process.env.NODE_ENV === 'test'

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
})

const transports: winston.transport[] = [consoleTransport]

if (!isTest) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/backend.log',
      format: winston.format.json(),
      level: process.env.FILE_LOG_LEVEL || 'info'
    })
  )
}

const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports
})

export interface CentralLogger {
  info(message: string, meta?: Meta): void
  warn(message: string, meta?: Meta): void
  error(message: string, meta?: Meta): void
  debug(message: string, meta?: Meta): void
}

export function createServiceLogger(serviceName: string): CentralLogger {
  const attachMeta = (meta?: Meta) => {
    if (meta === undefined) return { service: serviceName }
    if (typeof meta === 'object' && meta !== null) return { service: serviceName, ...(meta as Record<string, unknown>) }
    return { service: serviceName, data: meta }
  }

  return {
    info: (message: string, meta?: Meta) => baseLogger.info(message, attachMeta(meta)),
    warn: (message: string, meta?: Meta) => baseLogger.warn(message, attachMeta(meta)),
    error: (message: string, meta?: Meta) => baseLogger.error(message, attachMeta(meta)),
    debug: (message: string, meta?: Meta) => baseLogger.debug(message, attachMeta(meta)),
  }
}


