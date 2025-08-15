import { describe, it, expect, vi } from 'vitest';
import { OlivineClient } from '../index';
import { hashPayload } from '../provenance';

describe('OlivineClient.commit', () => {
  it('forwards commit with hashed input and output', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    // @ts-expect-error overriding global for test
    global.fetch = mockFetch;

    const client = new OlivineClient('http://api.test');
    const input = { foo: 'bar' };
    const output = { result: 42 };

    await client.commit({
      agentId: 'agent-1',
      version: '1.0.0',
      trigger: 'unit-test',
      input,
      output,
      artifacts: { file: 'file-1' },
      graphChanges: { nodes: [] },
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:00:10Z',
      confidence: 0.95,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://api.test/provenance/commit');

    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      agentId: 'agent-1',
      version: '1.0.0',
      trigger: 'unit-test',
      inputHash: hashPayload(input),
      outputHash: hashPayload(output),
      artifacts: { file: 'file-1' },
      graphChanges: { nodes: [] },
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:00:10Z',
      confidence: 0.95,
    });
  });
});
