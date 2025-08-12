import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to set tenant context for each request
 * Extracts org_id from request headers or JWT token and sets it in the request context
 */
export const tenantMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract org_id from headers (for testing purposes)
    let orgId = req.headers['x-org-id'] as string;
    
    // If not in headers, extract from JWT token (when auth is implemented)
    if (!orgId && req.headers.authorization) {
      // This is a placeholder for when we implement JWT authentication
      // orgId would be extracted from the decoded token
      // const token = req.headers.authorization.split(' ')[1];
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // orgId = decoded.org_id;
    }
    
    // Validate org_id exists
    if (!orgId) {
      return res.status(400).json({ 
        error: 'Organization ID is required', 
        message: 'X-Org-Id header must be provided' 
      });
    }
    
    // Store org_id in request for use in subsequent middleware and routes
    req.orgId = orgId;
    
    return next();
  } catch (error) {
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
}

// Extend Express Request type to include orgId
declare global {
  namespace Express {
    interface Request {
      orgId?: string;
    }
  }
}
