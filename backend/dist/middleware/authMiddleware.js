"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
exports.authorize = authorize;
const AuthService_1 = require("../services/AuthService");
const authService = new AuthService_1.AuthService();
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid authorization header'
            });
        }
        const token = authHeader.substring(7);
        const decoded = authService.verifyToken(token);
        req.userId = decoded.userId;
        req.orgId = decoded.orgId;
        req.userRole = decoded.role;
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token expired'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token'
            });
        }
        console.error('Error in auth middleware:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Authentication failed'
        });
    }
    return res.status(500).json({
        error: 'Internal server error',
        message: 'Authentication failed'
    });
};
exports.authMiddleware = authMiddleware;
function authorize(requiredRole) {
    return async (req, res, next) => {
        try {
            if (!req.userRole) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User not authenticated'
                });
            }
            if (req.userRole !== requiredRole) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: `User role '${req.userRole}' does not match required role '${requiredRole}'`
                });
            }
            next();
        }
        catch (error) {
            console.error('Error in authorization middleware:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Authorization check failed'
            });
        }
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Authorization check failed'
        });
    };
}
//# sourceMappingURL=authMiddleware.js.map