"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
const events_1 = require("events");
class EventBus {
    constructor() {
        this.emitter = new events_1.EventEmitter();
    }
    publish(event) {
        this.emitter.emit(event.type, event);
    }
    subscribe(type, handler) {
        const bound = (e) => handler(e);
        this.emitter.on(type, bound);
        return () => this.emitter.off(type, bound);
    }
}
exports.EventBus = EventBus;
//# sourceMappingURL=EventBus.js.map