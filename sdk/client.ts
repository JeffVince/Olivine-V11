export interface ClientOptions {
  baseUrl: string;
  token: string;
  maxRetries?: number;
  backoffMs?: number;
}

const RETRY_STATUSES = new Set([401, 403, 429]);

export class Client {
  public graph: APIModule;
  public storage: APIModule;
  public queue: QueueModule;
  public provenance: APIModule;

  private baseUrl: string;
  private token: string;
  private maxRetries: number;
  private backoffMs: number;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.token = opts.token;
    this.maxRetries = opts.maxRetries ?? 3;
    this.backoffMs = opts.backoffMs ?? 100;

    this.graph = new APIModule(this, 'graph');
    this.storage = new APIModule(this, 'storage');
    this.queue = new QueueModule(this);
    this.provenance = new APIModule(this, 'provenance');
  }

  public async request(path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${this.token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    if (RETRY_STATUSES.has(res.status) && attempt < this.maxRetries) {
      const delay = this.backoffMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request(path, init, attempt + 1);
    }

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
}

class APIModule {
  private prefix: string;
  private client: Client;

  constructor(client: Client, prefix: string) {
    this.client = client;
    this.prefix = prefix;
  }

  public request(path: string, init: RequestInit = {}) {
    return this.client.request(`/${this.prefix}${path}`, init);
  }
}

class QueueModule {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  heartbeat(jobId: string) {
    return this.client.request(`/queue/${jobId}/heartbeat`, { method: 'POST' });
  }

  commit(
    jobId: string,
    outputs: unknown,
    artifacts?: unknown,
    graphChanges?: unknown,
  ) {
    const body = JSON.stringify({ outputs, artifacts, graphChanges });
    return this.client.request(`/queue/${jobId}/commit`, {
      method: 'POST',
      body,
    });
  }

  fail(jobId: string, kind: string, message: string) {
    const body = JSON.stringify({ kind, message });
    return this.client.request(`/queue/${jobId}/fail`, {
      method: 'POST',
      body,
    });
  }
}

export default Client;
