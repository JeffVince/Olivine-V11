declare global {
    namespace NodeJS {
        interface Global {
            testUtils: {
                generateTestId: () => string;
                waitForCondition: (condition: () => Promise<boolean>, timeout?: number, interval?: number) => Promise<boolean>;
                cleanupDatabase: (services: {
                    neo4j?: any;
                    postgres?: any;
                }, orgId: string) => Promise<void>;
            };
        }
    }
}
export {};
//# sourceMappingURL=setup.d.ts.map