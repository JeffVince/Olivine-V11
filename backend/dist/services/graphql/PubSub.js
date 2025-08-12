"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPICS = exports.pubsub = void 0;
const graphql_subscriptions_1 = require("graphql-subscriptions");
exports.pubsub = new graphql_subscriptions_1.PubSub();
exports.TOPICS = {
    JobUpdated: 'JOB_UPDATED',
    JobLogAppended: 'JOB_LOG_APPENDED',
};
//# sourceMappingURL=PubSub.js.map