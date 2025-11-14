import { Request, Response, NextFunction } from 'express';
import { redis } from '../index';
import { write_to_logs } from '../utils/cache/Logger';

/**
 * Middleware to block requests from blocked IP addresses
 */
export const checkBlockedIP = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get client IP
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';

        // Check if IP is blocked
        const isBlocked = await redis.sismember('blocked_ips', clientIP);

        if (isBlocked) {
            const reason = await redis.hget('blocked_ip_reasons', clientIP);
            write_to_logs('errors', `Blocked IP attempted access: ${clientIP} - Reason: ${reason || 'Unknown'}`);

            return res.status(403).json({
                error: 'Access Denied',
                message: 'Your IP address has been blocked'
            });
        }

        next();
    } catch (error) {
        // If Redis fails, allow the request to continue (fail open)
        write_to_logs('errors', `IP check failed: ${error}`);
        next();
    }
};

/**
 * Middleware to check if a feature is enabled
 * @param featureName - Name of the feature to check
 */
export const requireFeature = (featureName: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const featureStatus = await redis.hget('feature_flags', featureName);

            // Feature is enabled by default if not set
            if (featureStatus === 'false') {
                write_to_logs('actions', `Blocked request to disabled feature: ${featureName} from ${req.ip}`);

                return res.status(503).json({
                    error: 'Feature Disabled',
                    message: `The ${featureName} feature is currently disabled. Please try again later.`,
                    feature: featureName
                });
            }

            next();
        } catch (error) {
            // If Redis fails, allow the request to continue (fail open)
            write_to_logs('errors', `Feature check failed for ${featureName}: ${error}`);
            next();
        }
    };
};

/**
 * Simple rate limiting middleware
 * @param windowMs - Time window in milliseconds
 * @param maxRequests - Maximum requests per window
 */
export const rateLimit = (windowMs: number = 60000, maxRequests: number = 100) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
            const key = `rate_limit:${clientIP}`;

            // Get current count
            const current = await redis.get(key);
            const count = current ? parseInt(current) : 0;

            if (count >= maxRequests) {
                write_to_logs('errors', `Rate limit exceeded for IP: ${clientIP} (${count} requests)`);

                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please try again later.',
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }

            // Increment counter
            await redis.incr(key);

            // Set expiry if this is the first request
            if (count === 0) {
                await redis.pexpire(key, windowMs);
            }

            // Add rate limit headers
            res.setHeader('X-RateLimit-Limit', maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', (maxRequests - count - 1).toString());

            next();
        } catch (error) {
            // If Redis fails, allow the request to continue (fail open)
            write_to_logs('errors', `Rate limit check failed: ${error}`);
            next();
        }
    };
};

/**
 * Middleware to log suspicious activity
 */
export const detectSuspiciousActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Check for suspicious patterns
        const suspiciousPatterns = [
            /sqlmap/i,
            /nikto/i,
            /nmap/i,
            /burp/i,
            /acunetix/i,
            /nessus/i,
            /qualys/i,
            /openvas/i
        ];

        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));

        if (isSuspicious) {
            write_to_logs('errors', `Suspicious user agent detected from ${clientIP}: ${userAgent}`);

            // Optionally auto-block suspicious IPs
            const autoBlock = await redis.hget('feature_flags', 'auto_block_suspicious');
            if (autoBlock === 'true') {
                await redis.sadd('blocked_ips', clientIP);
                await redis.hset('blocked_ip_reasons', clientIP, `Auto-blocked: Suspicious user agent - ${userAgent}`);
                await redis.hset('blocked_ip_timestamps', clientIP, new Date().toISOString());

                return res.status(403).json({
                    error: 'Access Denied',
                    message: 'Suspicious activity detected'
                });
            }
        }

        next();
    } catch (error) {
        // If detection fails, allow the request to continue
        next();
    }
};

// This is a pass-through middleware that doesn't do anything
// It's just here so the MiddlewareLoader doesn't fail
export default (req: Request, res: Response, next: NextFunction) => {
    next();
};
