export declare class AuthService {
    private postgresService;
    private jwtSecret;
    private saltRounds;
    constructor();
    hashPassword(password: string): Promise<string>;
    comparePasswords(password: string, hash: string): Promise<boolean>;
    generateToken(userId: string, orgId: string, role: string): string;
    static JwtPayloadGuard(payload: any): payload is JwtPayload;
    verifyToken(token: string): JwtPayload;
    authenticateUser(email: string, password: string): Promise<{
        id: string;
        orgId: string;
        role: string;
        name: string;
        avatar: string;
        notificationPrefs: Record<string, unknown>;
        token: string;
    } | null>;
    healthCheck(): Promise<boolean>;
    getUserById(userId: string): Promise<{
        id: string;
        orgId: string;
        email: string;
        role: string;
        name: string;
        avatar: string;
        notificationPrefs: Record<string, unknown>;
        createdAt: Date;
        lastLogin: Date;
    } | null>;
    close(): Promise<void>;
}
export interface JwtPayload {
    userId: string;
    orgId: string;
    role: string;
    iat?: number;
    exp?: number;
    iss?: string;
}
//# sourceMappingURL=AuthService.d.ts.map