import crypto from 'crypto'

export class CryptoService {
  // TODO: Implementation Plan - 05-Security-Implementation.md - Crypto service implementation for provenance signing
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend crypto service tests
  private readonly signingKey: string

  constructor(signingKey?: string) {
    const key = signingKey || process.env.PROVENANCE_SIGNING_KEY
    if (!key) throw new Error('PROVENANCE_SIGNING_KEY is not configured')
    this.signingKey = key
  }

  sign(payload: string): string {
    const hmac = crypto.createHmac('sha256', this.signingKey)
    hmac.update(payload)
    return hmac.digest('hex')
  }

  verify(payload: string, signature: string): boolean {
    const expected = this.sign(payload)
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }
}


