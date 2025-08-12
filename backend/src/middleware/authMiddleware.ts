import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

const authService = new AuthService();

/**
 * Authentication middleware to verify JWT tokens
 * Extracts token from Authorization header and verifies it
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Missing or invalid authorization header' 
      });
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = authService.verifyToken(token);
    
    // Store user info in request
    req.userId = decoded.userId;
    req.orgId = decoded.orgId;
    req.userRole = decoded.role;
    
    next();
  } catch (error: any) {
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
}

/**
 * Authorization middleware to check user roles
 * @param requiredRole Role required to access the resource
 */
export function authorize(requiredRole: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.userRole) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'User not authenticated' 
        });
      }
      
      // Check if user has required role
      if (req.userRole !== requiredRole) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: `User role '${req.userRole}' does not match required role '${requiredRole}'` 
        });
      }
      
      next();
    } catch (error) {
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

// Extend Express Request type to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}
