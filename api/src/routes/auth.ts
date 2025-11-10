import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin, postgres } from '../index';
import { requireAuth } from '../middlewares/auth';

const router = Router();

/**
 * Helper function to check if username exists
 */
async function usernameExists(username: string): Promise<boolean> {
    const result = await postgres.query(
        'SELECT username FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
    );
    return result.rows.length > 0;
}

/**
 * Helper function to get email by username
 */
async function getEmailByUsername(username: string): Promise<string | null> {
    const result = await postgres.query(
        'SELECT email FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
    );
    return result.rows.length > 0 ? result.rows[0].email : null;
}

/**
 * Sign up with username (creates internal email format)
 * POST /api/auth/signup-username
 * Body: { username: string, password: string }
 */
router.post('/signup-username', async (req: Request, res: Response) => {
    try {
        let { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        // Strip @fantasma.local if user accidentally included it
        username = username.replace(/@fantasma\.local$/i, '');

        // Validate username format (alphanumeric and underscore only)
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({
                error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
            });
        }

        // Check if username already exists
        if (await usernameExists(username)) {
            return res.status(400).json({
                error: 'Username already taken'
            });
        }

        // Create email in format: username@fantasma.local
        const email = `${username.toLowerCase()}@fantasma.local`;

        // Sign up with Supabase
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        // Store username mapping in database
        await postgres.query(
            'INSERT INTO users (user_id, username, email, created_at) VALUES ($1, $2, $3, NOW())',
            [data.user?.id, username, email]
        );

        res.json({
            user: data.user,
            email: email,
            username: username
        });
    } catch (error) {
        res.status(500).json({
            error: 'Signup failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Login with username
 * POST /api/auth/login-username
 * Body: { username: string, password: string }
 */
router.post('/login-username', async (req: Request, res: Response) => {
    try {
        let { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        // Strip @fantasma.local if user accidentally included it
        username = username.replace(/@fantasma\.local$/i, '');

        // Get email from username
        const email = await getEmailByUsername(username);

        if (!email) {
            return res.status(401).json({
                error: 'Invalid username or password'
            });
        }

        res.json({
            email: email,
            username: username
        });
    } catch (error) {
        res.status(500).json({
            error: 'Login failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Sign up a new user
 * POST /api/auth/signup
 * Body: { email: string, password: string, metadata?: object }
 */
router.post('/signup', async (req: Request, res: Response) => {
    try {
        const { email, password, metadata } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata || {}
            }
        });

        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.json({
            user: data.user,
            session: data.session
        });
    } catch (error) {
        res.status(500).json({
            error: 'Signup failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Sign in an existing user
 * POST /api/auth/login
 * Body: { email: string, password: string }
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({
                error: error.message
            });
        }

        res.json({
            user: data.user,
            session: data.session
        });
    } catch (error) {
        res.status(500).json({
            error: 'Login failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Sign out the current user
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return res.status(400).json({
                error: 'No token provided'
            });
        }

        const { error } = await supabaseAdmin.auth.admin.signOut(token);

        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.json({
            message: 'Successfully logged out'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Logout failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get current user info
 * GET /api/auth/user
 * Headers: Authorization: Bearer <token>
 */
router.get('/user', requireAuth, async (req: Request, res: Response) => {
    try {
        res.json({
            user: req.user
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get user',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Refresh the access token
 * POST /api/auth/refresh
 * Body: { refresh_token: string }
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                error: 'Refresh token is required'
            });
        }

        const { data, error } = await supabase.auth.refreshSession({
            refresh_token
        });

        if (error) {
            return res.status(401).json({
                error: error.message
            });
        }

        res.json({
            session: data.session
        });
    } catch (error) {
        res.status(500).json({
            error: 'Token refresh failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Request password reset email
 * POST /api/auth/reset-password
 * Body: { email: string }
 */
router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            });
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.json({
            message: 'Password reset email sent'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Password reset failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Update user password
 * POST /api/auth/update-password
 * Headers: Authorization: Bearer <token>
 * Body: { password: string }
 */
router.post('/update-password', requireAuth, async (req: Request, res: Response) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                error: 'New password is required'
            });
        }

        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return res.status(400).json({
                error: 'No token provided'
            });
        }

        // Use admin client to update password
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            req.user.id,
            { password }
        );

        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.json({
            message: 'Password updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Password update failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
