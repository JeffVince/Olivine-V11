"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = void 0;
const LoggerService_1 = require("./LoggerService");
class BaseService {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.logger = (0, LoggerService_1.createServiceLogger)(this.serviceName);
    }
}
exports.BaseService = BaseService;
//# sourceMappingURL=BaseService.js.map