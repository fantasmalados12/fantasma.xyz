import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middlewares/auth';
import { postgres, redis, supabase } from '../index';
import { getLogs, getLogsByType, clearLogs, LogEntry } from '../utils/cache/Logger';
import { write_to_logs } from '../utils/cache/Logger';

const router = Router();
const DEVELOPER_EMAIL = 'brendansides12@gmail.com';

/**
 * Middleware to check if the user has developer access
 */
const requireDeveloper = async (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.email !== DEVELOPER_EMAIL) {
        write_to_logs('errors', `Unauthorized developer access attempt by ${req.user?.email || 'unknown'}`);
        return res.status(403).json({
            error: 'Access denied',
            message: 'You do not have permission to access developer tools'
        });
    }
    next();
};

/**
 * GET /api/developer/logs
 * Get all system logs
 */
router.get('/logs', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    try {
        const { type, limit } = req.query;

        let logs: LogEntry[] = getLogs();

        // Filter by type if specified
        if (type && ['errors', 'service', 'actions', 'connections'].includes(type as string)) {
            logs = getLogsByType(type as any);
        }

        // Apply limit if specified
        if (limit && !isNaN(Number(limit))) {
            logs = logs.slice(-Number(limit));
        }

        res.json({
            success: true,
            count: logs.length,
            logs: logs.map(log => ({
                timestamp: log.timestamp,
                type: log.type,
                message: log.message
            }))
        });
    } catch (error) {
        write_to_logs('errors', `Failed to retrieve logs: ${error}`);
        res.status(500).json({
            error: 'Failed to retrieve logs',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * DELETE /api/developer/logs
 * Clear all system logs
 */
router.delete('/logs', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    try {
        clearLogs();
        write_to_logs('actions', `Logs cleared by developer: ${req.user?.email}`);

        res.json({
            success: true,
            message: 'All logs cleared successfully'
        });
    } catch (error) {
        write_to_logs('errors', `Failed to clear logs: ${error}`);
        res.status(500).json({
            error: 'Failed to clear logs',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/developer/status
 * Get status of all services
 */
router.get('/status', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    try {
        const status = {
            server: {
                status: 'running',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid,
                nodeVersion: process.version
            },
            postgresql: {
                status: 'unknown',
                totalConnections: 0,
                idleConnections: 0,
                waitingConnections: 0
            },
            redis: {
                status: 'unknown',
                connected: false
            },
            supabase: {
                status: 'configured',
                url: 'configured'
            }
        };

        // Check PostgreSQL
        try {
            const pgStatus = await postgres.query('SELECT NOW()');
            status.postgresql.status = 'connected';
            status.postgresql.totalConnections = postgres.totalCount;
            status.postgresql.idleConnections = postgres.idleCount;
            status.postgresql.waitingConnections = postgres.waitingCount;
        } catch (error) {
            status.postgresql.status = 'error';
        }

        // Check Redis
        try {
            status.redis.connected = redis.status === 'ready';
            status.redis.status = redis.status;
        } catch (error) {
            status.redis.status = 'error';
        }

        res.json({
            success: true,
            status
        });
    } catch (error) {
        write_to_logs('errors', `Failed to retrieve service status: ${error}`);
        res.status(500).json({
            error: 'Failed to retrieve service status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/developer/shutdown/:service
 * Gracefully shutdown a specific service or the entire server
 */
router.post('/shutdown/:service', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    const service = req.params.service;

    try {
        write_to_logs('actions', `Developer ${req.user?.email} initiated shutdown of: ${service}`);

        switch (service) {
            case 'server':
                res.json({
                    success: true,
                    message: 'Server shutdown initiated'
                });

                // Close database connections gracefully
                setTimeout(async () => {
                    write_to_logs('service', 'Shutting down server...');

                    try {
                        await postgres.end();
                        write_to_logs('service', 'PostgreSQL connection pool closed');
                    } catch (error) {
                        write_to_logs('errors', `Error closing PostgreSQL: ${error}`);
                    }

                    try {
                        await redis.quit();
                        write_to_logs('service', 'Redis connection closed');
                    } catch (error) {
                        write_to_logs('errors', `Error closing Redis: ${error}`);
                    }

                    write_to_logs('service', 'Server shutdown complete');
                    process.exit(0);
                }, 1000);
                break;

            case 'redis':
                await redis.disconnect();
                write_to_logs('service', 'Redis disconnected by developer');
                res.json({
                    success: true,
                    message: 'Redis connection closed'
                });
                break;

            case 'postgresql':
                res.status(400).json({
                    error: 'Cannot shutdown PostgreSQL independently',
                    message: 'Use server shutdown to close all connections gracefully'
                });
                break;

            default:
                res.status(400).json({
                    error: 'Invalid service',
                    message: `Service '${service}' not recognized. Valid options: server, redis`
                });
        }
    } catch (error) {
        write_to_logs('errors', `Failed to shutdown service ${service}: ${error}`);
        res.status(500).json({
            error: 'Failed to shutdown service',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/developer/database/stats
 * Get database statistics
 */
router.get('/database/stats', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    try {
        const stats: any = {
            postgresql: {},
            redis: {}
        };

            // PostgreSQL stats
    try {
        const tableStats = await postgres.query(`
            SELECT
                n.nspname AS schemaname,
                c.relname AS tablename,
                pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
                c.reltuples AS row_count
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
            ORDER BY pg_total_relation_size(c.oid) DESC
            LIMIT 10
        `);

        const dbSize = await postgres.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `);

        const connectionCount = await postgres.query(`
            SELECT count(*) as total FROM pg_stat_activity
        `);

        stats.postgresql = {
            databaseSize: dbSize.rows[0]?.size,
            activeConnections: connectionCount.rows[0]?.total,
            topTables: tableStats.rows,
            connectionPool: {
                total: postgres.totalCount,
                idle: postgres.idleCount,
                waiting: postgres.waitingCount
            }
        };
    } catch (error) {
        write_to_logs('errors', `PostgreSQL stats error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        stats.postgresql.error = error instanceof Error ? error.message : 'Unknown error';
    }


        // Redis stats
        try {
            const dbSize = await redis.dbsize();
            const memoryInfo = await redis.info('memory');

            stats.redis = {
                keys: dbSize,
                status: redis.status,
                memory: memoryInfo
            };
        } catch (error) {
            write_to_logs('errors', `Redis stats error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            stats.redis.error = error instanceof Error ? error.message : 'Unknown error';
        }

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        write_to_logs('errors', `Failed to retrieve database stats: ${error}`);
        res.status(500).json({
            error: 'Failed to retrieve database stats',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/developer/features
 * Get all feature flags
 */
router.get('/features', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    try {
        const features = await redis.hgetall('feature_flags');

        // Default features if none exist
        const defaultFeatures = {
            scraping: 'true',
            learning: 'true',
            image_upload: 'true',
            csv_import: 'true',
            registration: 'true',
            api_access: 'true'
        };

        const currentFeatures = Object.keys(defaultFeatures).reduce((acc, key) => {
            acc[key] = features[key] === 'false' ? false : true;
            return acc;
        }, {} as Record<string, boolean>);

        res.json({
            success: true,
            features: currentFeatures
        });
    } catch (error) {
        write_to_logs('errors', `Failed to retrieve feature flags: ${error}`);
        res.status(500).json({
            error: 'Failed to retrieve feature flags',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * PUT /api/developer/features/:feature
 * Enable or disable a feature
 */
router.put('/features/:feature', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    const feature = req.params.feature;
    const { enabled } = req.body;

    const validFeatures = ['scraping', 'learning', 'image_upload', 'csv_import', 'registration', 'api_access'];

    if (!validFeatures.includes(feature)) {
        return res.status(400).json({
            error: 'Invalid feature',
            message: `Feature '${feature}' not recognized. Valid options: ${validFeatures.join(', ')}`
        });
    }

    try {
        await redis.hset('feature_flags', feature, enabled ? 'true' : 'false');
        write_to_logs('actions', `Developer ${req.user?.email} ${enabled ? 'enabled' : 'disabled'} feature: ${feature}`);

        res.json({
            success: true,
            message: `Feature '${feature}' ${enabled ? 'enabled' : 'disabled'}`,
            feature,
            enabled
        });
    } catch (error) {
        write_to_logs('errors', `Failed to update feature flag ${feature}: ${error}`);
        res.status(500).json({
            error: 'Failed to update feature flag',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/developer/security/blocked-ips
 * Get list of blocked IP addresses
 */
router.get('/security/blocked-ips', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    try {
        const blockedIPs = await redis.smembers('blocked_ips');
        const ipDetails = [];

        for (const ip of blockedIPs) {
            const reason = await redis.hget('blocked_ip_reasons', ip);
            const timestamp = await redis.hget('blocked_ip_timestamps', ip);
            ipDetails.push({
                ip,
                reason: reason || 'Unknown',
                blockedAt: timestamp || 'Unknown'
            });
        }

        res.json({
            success: true,
            blockedIPs: ipDetails,
            count: blockedIPs.length
        });
    } catch (error) {
        write_to_logs('errors', `Failed to retrieve blocked IPs: ${error}`);
        res.status(500).json({
            error: 'Failed to retrieve blocked IPs',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/developer/security/block-ip
 * Block an IP address
 */
router.post('/security/block-ip', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    const { ip, reason } = req.body;

    if (!ip) {
        return res.status(400).json({
            error: 'IP address required',
            message: 'Please provide an IP address to block'
        });
    }

    try {
        await redis.sadd('blocked_ips', ip);
        await redis.hset('blocked_ip_reasons', ip, reason || 'Manually blocked');
        await redis.hset('blocked_ip_timestamps', ip, new Date().toISOString());

        write_to_logs('actions', `Developer ${req.user?.email} blocked IP: ${ip} - Reason: ${reason || 'Manual'}`);

        res.json({
            success: true,
            message: `IP ${ip} has been blocked`,
            ip,
            reason: reason || 'Manually blocked'
        });
    } catch (error) {
        write_to_logs('errors', `Failed to block IP ${ip}: ${error}`);
        res.status(500).json({
            error: 'Failed to block IP',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * DELETE /api/developer/security/unblock-ip/:ip
 * Unblock an IP address
 */
router.delete('/security/unblock-ip/:ip', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    const ip = req.params.ip;

    try {
        await redis.srem('blocked_ips', ip);
        await redis.hdel('blocked_ip_reasons', ip);
        await redis.hdel('blocked_ip_timestamps', ip);

        write_to_logs('actions', `Developer ${req.user?.email} unblocked IP: ${ip}`);

        res.json({
            success: true,
            message: `IP ${ip} has been unblocked`
        });
    } catch (error) {
        write_to_logs('errors', `Failed to unblock IP ${ip}: ${error}`);
        res.status(500).json({
            error: 'Failed to unblock IP',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/developer/security/rate-limit-stats
 * Get rate limit statistics
 */
router.get('/security/rate-limit-stats', requireAuth, requireDeveloper, async (req: Request, res: Response) => {
    try {
        const keys = await redis.keys('rate_limit:*');
        const stats: any[] = [];

        for (const key of keys.slice(0, 50)) { // Limit to 50 most recent
            const value = await redis.get(key);
            const ttl = await redis.ttl(key);
            const ip = key.replace('rate_limit:', '');

            stats.push({
                ip,
                requests: parseInt(value || '0'),
                expiresIn: ttl
            });
        }

        // Sort by request count descending
        stats.sort((a, b) => b.requests - a.requests);

        res.json({
            success: true,
            stats,
            total: keys.length
        });
    } catch (error) {
        write_to_logs('errors', `Failed to retrieve rate limit stats: ${error}`);
        res.status(500).json({
            error: 'Failed to retrieve rate limit stats',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
