import { Client } from '../client';

describe('Client retry logic', () => {
  let timeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    timeoutSpy = jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const statuses = [401, 403, 429];

  test.each(statuses)('retries on %s', async (status) => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ status, ok: false })
      .mockResolvedValue({ status: 200, ok: true, json: async () => ({}) });

    // @ts-ignore
    global.fetch = fetchMock;

    const client = new Client({ baseUrl: 'http://api', token: 'test', backoffMs: 100 });

    const promise = client.queue.heartbeat('1');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.runOnlyPendingTimersAsync();

    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
  });
});
