# Session Cookie Issue - Fix Summary

## Problem

Users authenticated with an invite code could successfully reach the RSVP page but encountered a "Insufficient role" error when the page tried to load guest RSVP data. The network investigation revealed:

1. `/api/auth/me` request returns 200 (user IS authenticated)
2. `/api/guests/{guest_id}` request returns 403 "Insufficient role" (same request should work)

This indicates the session cookie was not being properly transmitted on subsequent API requests, particularly across the Vite dev server and backend running on different ports (3000 vs 3001).

## Root Causes

### 1. Missing Module Exports (FIXED)
**File:** `production/frontend/src/api/auth.ts`

The `fetchCurrentUser()` function was being called but not exported from the module.

**Fix:** Added explicit exports for `fetchCurrentUser()` and `logout()` functions (commit 583860a)

### 2. Session Cookie SameSite Policy (FIXED)
**File:** `production/backend/app/main.py`

The SessionMiddleware was configured with `same_site="lax"` in all environments, which prevents cookies from being sent to different ports (e.g., :3000 → :3001).

**Fix:** Changed to use `same_site="none"` for development environment to allow cross-port cookie transmission (commit 58608e8)

### 3. Vite Proxy Cookie Domain Handling (FIXED)
**File:** `production/frontend/vite.config.ts`

The Vite dev server proxy forwards requests from `:3000` to `127.0.0.1:3001`, but wasn't properly configured to preserve cookie domain information, causing the backend's session cookies to not be available to the browser.

**Fix:** Added `cookieDomainRewrite: { '*': '' }` configuration to prevent the proxy from rewriting cookie domains (commit 46e6cd3)

```typescript
proxy: {
  '/api': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    cookieDomainRewrite: { '*': '' }  // Preserve original cookie domain
  }
}
```

## Files Modified

1. `production/frontend/src/api/auth.ts` - Added missing function exports
2. `production/backend/app/main.py` - Fixed SessionMiddleware same_site policy
3. `production/frontend/vite.config.ts` - Added cookie domain rewrite configuration

## Testing & Verification

To verify the fixes work:

1. **Deploy latest code to staging** using the GitHub Actions workflow or manual deployment
2. **Test the complete login→RSVP flow:**
   - Navigate to `http://192.168.0.32:3000/invite`
   - Enter a valid invite code (must exist in database)
   - Should redirect to RSVP page and load guest data
   - Should see RSVP form with guest name and form fields
   - Should be able to select attendance, meal choice, and save RSVP

3. **Network inspection** (browser DevTools):
   - Verify `/api/auth/login` returns 200 and sets session cookie
   - Verify `/api/auth/me` returns 200 with authenticated user data
   - Verify `/api/guests/{guest_id}` returns 200 with guest RSVP data (not 403)
   - Verify all subsequent API requests include the session cookie

## Production Deployment Notes

- SessionMiddleware in production still uses `same_site="lax"` (appropriate for HTTPS)
- Production will use the built frontend (not Vite dev server), so the proxy configuration doesn't affect it
- Ensure database has valid test/demo invite codes before testing on staging

## Related Commits

- 583860a: Add missing auth.ts exports
- 58608e8: Fix SessionMiddleware same_site policy for development
- 46e6cd3: Improve Vite proxy cookie handling
