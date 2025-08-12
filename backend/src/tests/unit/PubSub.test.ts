import { pubsub, TOPICS } from '../../services/graphql/PubSub';
import { PubSub } from 'graphql-subscriptions';

// Mock PubSub class
jest.mock('graphql-subscriptions', () => ({
  PubSub: jest.fn()
}));

describe('PubSub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pubsub instance', () => {
    it('should create a new PubSub instance', () => {
      expect(PubSub).toHaveBeenCalled();
      expect(pubsub).toBeInstanceOf(PubSub);
    });
  });

  describe('TOPICS', () => {
    it('should define JobUpdated topic', () => {
      expect(TOPICS.JobUpdated).toBe('JOB_UPDATED');
    });

    it('should define JobLogAppended topic', () => {
      expect(TOPICS.JobLogAppended).toBe('JOB_LOG_APPENDED');
    });

    it('should have exactly two topics defined', () => {
      expect(Object.keys(TOPICS)).toHaveLength(2);
    });
  });
});
