export declare class CryptoService {
    private readonly signingKey;
    constructor(signingKey?: string);
    sign(payload: string): string;
    verify(payload: string, signature: string): boolean;
    hash(data: string): string;
}
//# sourceMappingURL=CryptoService.d.ts.map