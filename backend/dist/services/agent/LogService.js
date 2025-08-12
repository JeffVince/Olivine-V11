"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogService = void 0;
const PubSub_1 = require("../graphql/PubSub");
class LogService {
    async appendLog(entry) {
        await PubSub_1.pubsub.publish(PubSub_1.TOPICS.JobLogAppended, { jobLogAppended: entry });
    }
}
exports.LogService = LogService;
//# sourceMappingURL=LogService.js.map