"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PubSub_1 = require("../../services/graphql/PubSub");
const graphql_subscriptions_1 = require("graphql-subscriptions");
jest.mock('graphql-subscriptions', () => ({
    PubSub: jest.fn()
}));
describe('PubSub', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('pubsub instance', () => {
        it('should create a new PubSub instance', () => {
            expect(graphql_subscriptions_1.PubSub).toHaveBeenCalled();
            expect(PubSub_1.pubsub).toBeInstanceOf(graphql_subscriptions_1.PubSub);
        });
    });
    describe('TOPICS', () => {
        it('should define JobUpdated topic', () => {
            expect(PubSub_1.TOPICS.JobUpdated).toBe('JOB_UPDATED');
        });
        it('should define JobLogAppended topic', () => {
            expect(PubSub_1.TOPICS.JobLogAppended).toBe('JOB_LOG_APPENDED');
        });
        it('should have exactly two topics defined', () => {
            expect(Object.keys(PubSub_1.TOPICS)).toHaveLength(2);
        });
    });
});
//# sourceMappingURL=PubSub.test.js.map