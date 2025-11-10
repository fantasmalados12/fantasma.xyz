import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../index';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

/**
 * Middleware to verify JWT token from Supabase
 * Attaches user object to req.user if valid
 * Use this middleware on routes that require authentication
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No authorization token provided'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify the JWT token with Supabase
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                error: 'Invalid or expired token'
            });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Authentication failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Optional auth middleware - doesn't fail if no token
 * Just attaches user if token is valid
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);

        if (user) {
            req.user = user;
        }

        next();
    } catch (error) {
        // Just continue without user if auth fails
        next();
    }
};

// This is a pass-through middleware that doesn't do anything
// It's just here so the MiddlewareLoader doesn't fail
export default (req: Request, res: Response, next: NextFunction) => {
    next();
};
