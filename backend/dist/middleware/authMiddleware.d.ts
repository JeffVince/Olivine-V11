import { Request, Response, NextFunction } from 'express';
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare function authorize(requiredRole: string): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userRole?: string;
        }
    }
}
//# sourceMappingURL=authMiddleware.d.ts.map