# Authentication System Setup

This project uses Supabase for authentication. Follow these steps to set it up:

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to finish setting up (takes ~2 minutes)

## 2. Get Your Supabase Credentials

1. Go to your project settings: `https://app.supabase.com/project/_/settings/api`
2. Copy the following values:
   - Project URL
   - Anon/Public Key
   - Service Role Key (keep this secret!)

## 3. Configure Backend (API)

Update `/config/config.yaml` with your Supabase credentials:

```yaml
database:
  supabase:
    dev:
      url: YOUR_SUPABASE_PROJECT_URL
      anon_key: YOUR_SUPABASE_ANON_KEY
      service_role_key: YOUR_SUPABASE_SERVICE_ROLE_KEY
    prod:
      url: YOUR_SUPABASE_PROJECT_URL_PROD
      anon_key: YOUR_SUPABASE_ANON_KEY_PROD
      service_role_key: YOUR_SUPABASE_SERVICE_ROLE_KEY_PROD
```

## 4. Configure Frontend

1. Copy the `.env.example` file to `.env` in the frontend directory:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Update `/frontend/.env` with your Supabase credentials:
   ```
   PUBLIC_SUPABASE_URL=your_supabase_project_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

## 5. Run the Application

Start both the backend and frontend:

```bash
# Terminal 1 - Backend
cd api
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Features

### Email-Based Authentication
This system uses standard **email and password** authentication:
- Users sign up and log in with their email addresses
- No email verification required (disabled in Supabase settings)
- Passwords are securely stored by Supabase

### Authentication Pages
- **Login/Signup**: `/auth` - Beautiful glassmorphic login/signup page with animated gradient background
- **Authentication Guard**: All routes except `/auth` require authentication
- No navbar/sidebar on auth pages - just the floating "fantasma" title and login form
- Smooth animations with floating title effect

### Protected Routes
To protect a route in the backend, use the `requireAuth` middleware:

```typescript
import { requireAuth } from '../middlewares/auth';

router.get('/protected-route', requireAuth, async (req, res) => {
    // req.user will contain the authenticated user
    res.json({ user: req.user });
});
```

### Frontend Auth State
The frontend uses a reactive auth store (`authStore.svelte.ts`) that provides:

```typescript
import { authStore } from './utils/authStore.svelte';

// Check if user is authenticated
if (authStore.isAuthenticated()) {
    // User is logged in
}

// Get current user
const user = authStore.user;

// Get access token for API calls
const token = authStore.getAccessToken();

// Sign up
await authStore.signUp(email, password);

// Sign in
await authStore.signIn(email, password);

// Sign out
await authStore.signOut();
```

### Making Authenticated API Calls
Use the `getAuthHeaders()` helper to include authentication tokens:

```typescript
import { getAPIUrlBasedOffEnviornment, getAuthHeaders } from './utils/API';
import axios from 'axios';

const response = await axios.get(
    `${getAPIUrlBasedOffEnviornment()}/protected-route`,
    { headers: getAuthHeaders() }
);
```

## API Endpoints

All authentication endpoints are available at `/api/auth`:

- `POST /api/auth/signup` - Create a new account
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123",
    "metadata": {} // optional
  }
  ```

- `POST /api/auth/login` - Sign in
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123"
  }
  ```

- `POST /api/auth/logout` - Sign out (requires auth)
  - Headers: `Authorization: Bearer <token>`

- `GET /api/auth/user` - Get current user (requires auth)
  - Headers: `Authorization: Bearer <token>`

- `POST /api/auth/refresh` - Refresh access token
  ```json
  {
    "refresh_token": "your_refresh_token"
  }
  ```

- `POST /api/auth/reset-password` - Request password reset
  ```json
  {
    "email": "user@example.com"
  }
  ```

- `POST /api/auth/update-password` - Update password (requires auth)
  ```json
  {
    "password": "newPassword123"
  }
  ```

## Supabase Setup Tips

### Disable Email Confirmation (Required)
For immediate access without email verification:

1. Go to your Supabase dashboard
2. Navigate to Authentication > Providers > Email
3. Toggle **"Confirm email"** to **OFF**
4. Save changes

⚠️ **Important**: Email confirmation must be disabled for users to sign up and log in immediately without verifying their email.

### Configure Email Templates
Customize email templates in Authentication > Email Templates

### Set Up Row Level Security (RLS)
If you're storing user data in Supabase tables, set up RLS policies:

```sql
-- Example: Users can only read their own data
CREATE POLICY "Users can view own data" ON your_table
    FOR SELECT
    USING (auth.uid() = user_id);
```

## Troubleshooting

### "Invalid or expired token" errors
- Make sure your Supabase credentials are correct
- Check that the token is being sent in the Authorization header
- Verify the token hasn't expired (default: 1 hour)

### CORS errors
- Check that your API's CORS settings allow requests from your frontend domain
- Verify the origin in `/config/config.yaml` under `server.cors.origin`

### Frontend can't connect to Supabase
- Verify the environment variables are set correctly in `/frontend/.env`
- Make sure the variables start with `PUBLIC_` for SvelteKit
- Restart the dev server after changing environment variables
