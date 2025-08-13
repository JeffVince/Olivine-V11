export {};
declare global {
    let testUtils: {
        generateTestId: () => string;
        waitForCondition: (condition: () => Promise<boolean>, timeout?: number, interval?: number) => Promise<boolean>;
        cleanupDatabase: (services: {
            neo4j?: Record<string, unknown>;
            postgres?: Record<string, unknown>;
        }, orgId: string) => Promise<void>;
    };
}
export {};
export {};
//# sourceMappingURL=setup.d.ts.map