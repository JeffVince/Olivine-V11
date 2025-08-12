import { Request, Response, NextFunction } from 'express';
export declare const tenantMiddleware: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
declare global {
    namespace Express {
        interface Request {
            orgId?: string;
        }
    }
}
//# sourceMappingURL=tenantMiddleware.d.ts.map