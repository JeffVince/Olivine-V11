export interface QuotaInfo {
  limit?: number;
  remaining?: number;
  reset?: number; // epoch ms
}

export interface RequestResult<T = any> {
  data: T;
  quota?: QuotaInfo;
  retryAfter?: number;
}

export class QuotaError extends Error {
  status: number;
  retryAfter?: number;
  quota?: QuotaInfo;
  constructor(message: string, status: number, retryAfter?: number, quota?: QuotaInfo) {
    super(message);
    this.name = 'QuotaError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.quota = quota;
  }
}

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parseQuota(headers: Headers): QuotaInfo {
  return {
    limit: parseNumber(headers.get('x-quota-limit')),
    remaining: parseNumber(headers.get('x-quota-remaining')),
    reset: parseNumber(headers.get('x-quota-reset')),
  };
}

export class Client {
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = globalThis.fetch) {
    this.fetchFn = fetchFn;
  }

  async request<T = any>(url: string, init?: RequestInit): Promise<RequestResult<T>> {
    const res = await this.fetchFn(url, init);
    const quota = parseQuota(res.headers);
    const retryAfter = parseNumber(res.headers.get('retry-after'));

    if (res.status === 429) {
      throw new QuotaError('Rate limit exceeded', 429, retryAfter, quota);
    }

    let data: T | undefined;
    try {
      data = (await res.json()) as T;
    } catch {
      // ignore JSON parse errors
    }

    return { data: data as T, quota, retryAfter };
  }
}

