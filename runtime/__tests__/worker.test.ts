import { RuntimeWorker, JobEnvelope, RuntimeClient } from '../worker'

jest.useFakeTimers()

describe('RuntimeWorker', () => {
  const baseJob: JobEnvelope = { id: '1', queue: 'q', payload: {} }

  test('sends heartbeats at interval until completion', async () => {
    const client: RuntimeClient = {
      heartbeat: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    }

    const handler = jest
      .fn()
      .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('ok'), 25)))

    const runPromise = RuntimeWorker.run(client, baseJob, handler, 10)

    jest.advanceTimersByTime(25)
    await runPromise

    expect(client.heartbeat).toHaveBeenCalledTimes(2)
    expect(client.commit).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(50)
    expect(client.heartbeat).toHaveBeenCalledTimes(2)
  })

  test('commits on success and fails exclusively', async () => {
    const commitClient: RuntimeClient = {
      heartbeat: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    }
    await RuntimeWorker.run(commitClient, baseJob, async () => 'ok', 10)
    expect(commitClient.commit).toHaveBeenCalledTimes(1)
    expect(commitClient.fail).not.toHaveBeenCalled()

    const failClient: RuntimeClient = {
      heartbeat: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    }
    await RuntimeWorker.run(failClient, baseJob, async () => {
      throw new Error('bad')
    }, 10)
    expect(failClient.fail).toHaveBeenCalledTimes(1)
    expect(failClient.commit).not.toHaveBeenCalled()
  })
})
