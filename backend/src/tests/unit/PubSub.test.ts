import { createPubSub, pubsub, TOPICS } from '../../services/graphql/PubSub';
import { PubSub } from 'graphql-subscriptions';

// Mock PubSub class
jest.mock('graphql-subscriptions', () => {
  const Actual = jest.requireActual('graphql-subscriptions');
  return {
    ...Actual,
    PubSub: jest.fn().mockImplementation(() => new Actual.PubSub()),
  };
});

describe('PubSub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pubsub instance', () => {
    it('should create a new PubSub instance', () => {
      // After jest.clearAllMocks in beforeEach, call factory to trigger constructor spy
      const instance = createPubSub();
      expect(PubSub).toHaveBeenCalled();
      const { PubSub: ActualPubSub } = jest.requireActual('graphql-subscriptions');
      expect(instance).toBeInstanceOf(ActualPubSub);
      expect(pubsub).toBeTruthy();
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
