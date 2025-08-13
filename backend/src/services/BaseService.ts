import { createServiceLogger, CentralLogger } from './LoggerService'

export interface Logger {
  info(message: string, meta?: unknown): void
  warn(message: string, meta?: unknown): void
  error(message: string, meta?: unknown): void
  debug(message: string, meta?: unknown): void
}

export class BaseService {
  public readonly serviceName: string
  protected readonly logger: CentralLogger

  constructor(serviceName: string) {
    this.serviceName = serviceName
    this.logger = createServiceLogger(this.serviceName)
  }
}


