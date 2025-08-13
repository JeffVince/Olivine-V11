"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceLogger = createServiceLogger;
const winston_1 = __importDefault(require("winston"));
const isTest = process.env.NODE_ENV === 'test';
const consoleTransport = new winston_1.default.transports.Console({
    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
});
const transports = [consoleTransport];
if (!isTest) {
    transports.push(new winston_1.default.transports.File({
        filename: 'logs/backend.log',
        format: winston_1.default.format.json(),
        level: process.env.FILE_LOG_LEVEL || 'info'
    }));
}
const baseLogger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports
});
function createServiceLogger(serviceName) {
    const attachMeta = (meta) => {
        if (meta === undefined)
            return { service: serviceName };
        if (typeof meta === 'object' && meta !== null)
            return { service: serviceName, ...meta };
        return { service: serviceName, data: meta };
    };
    return {
        info: (message, meta) => baseLogger.info(message, attachMeta(meta)),
        warn: (message, meta) => baseLogger.warn(message, attachMeta(meta)),
        error: (message, meta) => baseLogger.error(message, attachMeta(meta)),
        debug: (message, meta) => baseLogger.debug(message, attachMeta(meta)),
    };
}
//# sourceMappingURL=LoggerService.js.map