import { LogService, LogEntry } from '../../services/agent/LogService';
import { pubsub } from '../../services/graphql/PubSub';

// Mock PubSub
jest.mock('../../services/graphql/PubSub', () => ({
  pubsub: {
    publish: jest.fn()
  },
  TOPICS: {
    JobLogAppended: 'JOB_LOG_APPENDED'
  }
}));

describe('LogService', () => {
  let logService: LogService;

  beforeEach(() => {
    jest.clearAllMocks();
    logService = new LogService();
  });

  describe('appendLog', () => {
    it('should publish log entry to PubSub', async () => {
      const logEntry: LogEntry = {
        jobId: 'test-job-id',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test log message'
      };

      await logService.appendLog(logEntry);

      expect(pubsub.publish).toHaveBeenCalledWith(
        'JOB_LOG_APPENDED',
        { jobLogAppended: logEntry }
      );
    });

    it('should handle different log levels', async () => {
      const logEntries: LogEntry[] = [
        {
          jobId: 'test-job-id-1',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Info message'
        },
        {
          jobId: 'test-job-id-2',
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: 'Warning message'
        },
        {
          jobId: 'test-job-id-3',
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Error message'
        }
      ];

      for (const logEntry of logEntries) {
        await logService.appendLog(logEntry);
        
        expect(pubsub.publish).toHaveBeenCalledWith(
          'JOB_LOG_APPENDED',
          { jobLogAppended: logEntry }
        );
      }
    });

    it('should handle multiple log entries for the same job', async () => {
      const jobId = 'test-job-id';
      const logEntry1: LogEntry = {
        jobId,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'First log message'
      };
      const logEntry2: LogEntry = {
        jobId,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Second log message'
      };

      await logService.appendLog(logEntry1);
      await logService.appendLog(logEntry2);

      expect(pubsub.publish).toHaveBeenCalledTimes(2);
      expect(pubsub.publish).toHaveBeenCalledWith(
        'JOB_LOG_APPENDED',
        { jobLogAppended: logEntry1 }
      );
      expect(pubsub.publish).toHaveBeenCalledWith(
        'JOB_LOG_APPENDED',
        { jobLogAppended: logEntry2 }
      );
    });
  });
});
