import { Client } from '../../sdk/client';
import { RateLimiter } from '../../runtime/rateLimiter';
import { Backpressure } from '../../runtime/backpressure';

describe('rate limiting backpressure', () => {
  it('backs off on 429 and resumes requests', async () => {
    const now = Date.now();
    const responses: Array<{ status: number; headers: Record<string, string> }> = [
      { status: 200, headers: { 'x-quota-remaining': '2', 'x-quota-reset': String(now + 50) } },
      { status: 200, headers: { 'x-quota-remaining': '1', 'x-quota-reset': String(now + 50) } },
      { status: 429, headers: { 'retry-after': '100', 'x-quota-reset': String(now + 100) } },
      { status: 200, headers: { 'x-quota-remaining': '1', 'x-quota-reset': String(now + 150) } },
      { status: 200, headers: { 'x-quota-remaining': '0', 'x-quota-reset': String(now + 150) } },
    ];

    const fetch = jest.fn(() => {
      const r = responses.shift();
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: r!.status,
          headers: r!.headers,
        })
      );
    });

    const client = new Client(fetch as any);
    const limiter = new RateLimiter();
    const bp = new Backpressure(limiter);

    const start = Date.now();
    const completions: number[] = [];
    const jobs = Array.from({ length: 4 }, () =>
      bp.run(() => client.request('http://example.com')).then(() => {
        completions.push(Date.now() - start);
      })
    );

    await Promise.all(jobs);

    expect(fetch).toHaveBeenCalledTimes(5);
    expect(completions[0]).toBeLessThan(80);
    expect(completions[1]).toBeLessThan(80);
    expect(completions[2]).toBeGreaterThanOrEqual(100);
    expect(completions[3]).toBeGreaterThanOrEqual(100);
  });
});

