export interface EventEnvelope<T = any> {
    type: string;
    orgId: string;
    timestamp: string;
    payload: T;
}
export declare class EventBus {
    private readonly emitter;
    publish<T>(event: EventEnvelope<T>): void;
    subscribe<T>(type: string, handler: (event: EventEnvelope<T>) => void): () => void;
}
//# sourceMappingURL=EventBus.d.ts.map