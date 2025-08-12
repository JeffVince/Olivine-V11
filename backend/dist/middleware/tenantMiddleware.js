"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = void 0;
const tenantMiddleware = (req, res, next) => {
    try {
        let orgId = req.headers['x-org-id'];
        if (!orgId && req.headers.authorization) {
        }
        if (!orgId) {
            return res.status(400).json({
                error: 'Organization ID is required',
                message: 'X-Org-Id header must be provided'
            });
        }
        req.orgId = orgId;
        return next();
    }
    catch (error) {
        console.error('Error in tenant middleware:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to extract organization ID'
        });
    }
    return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to extract organization ID'
    });
};
exports.tenantMiddleware = tenantMiddleware;
//# sourceMappingURL=tenantMiddleware.js.map