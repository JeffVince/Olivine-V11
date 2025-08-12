export declare class AuthService {
    private postgresService;
    private jwtSecret;
    private saltRounds;
    constructor();
    hashPassword(password: string): Promise<string>;
    comparePasswords(password: string, hash: string): Promise<boolean>;
    generateToken(userId: string, orgId: string, role: string): string;
    verifyToken(token: string): any;
    authenticateUser(email: string, password: string): Promise<any>;
    healthCheck(): Promise<boolean>;
    getUserById(userId: string): Promise<any>;
    close(): Promise<void>;
}
//# sourceMappingURL=AuthService.d.ts.map