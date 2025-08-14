"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPICS = exports.pubsub = exports.createPubSub = void 0;
const { PubSub } = require('graphql-subscriptions');
const createPubSub = () => new PubSub();
exports.createPubSub = createPubSub;
exports.pubsub = (0, exports.createPubSub)();
exports.TOPICS = {
    JobUpdated: 'JOB_UPDATED',
    JobLogAppended: 'JOB_LOG_APPENDED',
};
exports.default = exports.pubsub;
//# sourceMappingURL=PubSub.js.map