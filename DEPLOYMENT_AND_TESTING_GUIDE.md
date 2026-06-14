# Deployment and Testing Guide

## Current Status

All code fixes have been committed to `main` branch:
- ✅ Fixed missing module exports in `production/frontend/src/api/auth.ts`
- ✅ Fixed SessionMiddleware configuration in `production/backend/app/main.py`
- ✅ Fixed tasks.py import error (AuthUser → UserResponse)
- ✅ Improved Vite proxy cookie handling in `production/frontend/vite.config.ts`
- ✅ Added comprehensive fix documentation

**Latest commits:**
```
fd3c39a fix: correct schema import and SessionMiddleware configuration
115859d docs: add session cookie fix summary and verification guide
46e6cd3 fix: improve Vite proxy cookie handling and add debug seed endpoint
```

## Deployment Blocker: Missing GitHub Actions Secrets

The automated GitHub Actions deployment failed because the following environment secrets are not configured for the **Staging** environment:

- `DEPLOY_HOST` (should be: `192.168.0.32`)
- `DEPLOY_USER` (SSH user with access to staging server)
- `DEPLOY_SSH_KEY` (private SSH key for authentication)

### How to Configure Deployment Secrets

1. **Go to repository settings:**
   - https://github.com/VainAsher/ashley-hazel-wedding-portal/settings/environments

2. **Click on "Staging" environment** (or create it if it doesn't exist)

3. **Add the following secrets:**
   - **Name:** `DEPLOY_HOST` | **Value:** `192.168.0.32`
   - **Name:** `DEPLOY_USER` | **Value:** `[SSH username for staging server]`
   - **Name:** `DEPLOY_SSH_KEY` | **Value:** `[Your private SSH key]`

4. **Once configured, re-trigger the deployment:**
   ```bash
   gh workflow run deploy.yml -f environment=staging -f action=deploy --repo VainAsher/ashley-hazel-wedding-portal
   ```

## Alternative: Manual Deployment

If you prefer to deploy manually to the staging server at `192.168.0.32`:

```bash
# SSH into the staging server
ssh user@192.168.0.32

# Navigate to the deployment directory
cd /home/deploy/wedding-dashboard

# Pull latest code
git fetch origin main
git checkout -f <commit-hash>

# Run deployment script
cd production/scripts
chmod +x deploy.sh
DEPLOY_ENVIRONMENT=staging ./deploy.sh deploy
```

## Testing After Deployment

Once the code is deployed to staging (`192.168.0.32`), follow these testing steps:

### 1. Prepare Test Data

The database needs valid invite codes. Create a test invite in the database:

```sql
-- First, ensure a wedding exists
INSERT INTO weddings (couple_first_name, couple_last_name, wedding_date, venue_name)
VALUES ('Ashley', 'Hazel', '2025-06-15', 'Test Venue')
ON CONFLICT DO NOTHING;

-- Create a test guest
INSERT INTO guests (wedding_id, name, email, relationship, rsvp_status)
SELECT id, 'Test Guest', 'test@example.com', 'friend', 'pending'
FROM weddings
WHERE couple_first_name = 'Ashley'
LIMIT 1;

-- Create an invite for the guest
INSERT INTO invites (code, wedding_id, guest_id, household_name, role)
SELECT 'TEST_001', w.id, g.id, 'Test Household', 'guest'
FROM weddings w, guests g
WHERE w.couple_first_name = 'Ashley' AND g.name = 'Test Guest'
AND NOT EXISTS (SELECT 1 FROM invites WHERE code = 'TEST_001');
```

### 2. Browser Testing Workflow

**Test the complete RSVP login flow:**

1. Navigate to: `http://192.168.0.32:3000/invite`
2. Enter invite code: `TEST_001` (or your created code)
3. Click "Continue"
4. Expected: Should redirect to RSVP page and load guest form
5. Verify form loads with:
   - Guest name displayed
   - RSVP options (Accept/Decline/Tentative)
   - Meal choices dropdown
   - Dietary notes field
   - Plus one name field

### 3. Network Verification (Browser DevTools)

Open browser DevTools (F12) and check the Network tab:

**Requests should show:**
- ✅ `POST /api/auth/login` → Status 200
  - Response contains user object with guest_id
  - Set-Cookie header present
- ✅ `GET /api/auth/me` → Status 200
  - Returns authenticated user data
  - Session cookie sent with request
- ✅ `GET /api/guests/{id}` → Status 200 (NOT 403)
  - Returns guest RSVP data
  - Session cookie sent with request
- ✅ `PATCH /api/guests/{id}` → Status 200
  - Successfully saves RSVP after form submission

**All requests should include:**
- Request Header: `Cookie: session=<session-id>` (Cookies sent)
- Response Header: `Set-Cookie: session=<session-id>` (After login)

### 4. Verify Cookie Handling

In DevTools → Application → Cookies → `http://192.168.0.32`:
- Should see `session` cookie after successful login
- Cookie should have:
  - Domain: `192.168.0.32` (or blank for current site)
  - Path: `/`
  - SameSite: `None` (development) or `Lax` (production)
  - HttpOnly: checked

## Expected Behavior After Fixes

### Before Fixes (Failing)
```
Login: POST /api/auth/login → 200 ✓
Auth Check: GET /api/auth/me → 200 ✓
RSVP Load: GET /api/guests/678 → 403 ✗ "Insufficient role"
```

### After Fixes (Working)
```
Login: POST /api/auth/login → 200 ✓
Auth Check: GET /api/auth/me → 200 ✓
RSVP Load: GET /api/guests/678 → 200 ✓
RSVP Save: PATCH /api/guests/678 → 200 ✓
```

## Troubleshooting

### "Code not found" error
- Invite code doesn't exist in database
- Solution: Verify the invite code exists using the SQL query above

### "Insufficient role" error on RSVP page
- Session cookie not being transmitted properly
- Solution: 
  - Check DevTools → Network → verify cookies are sent
  - Check browser DevTools → Application → Cookies
  - Restart frontend dev server if using dev environment

### Blank page after login
- Frontend not loading guest data
- Solution:
  - Check browser console for JavaScript errors
  - Check Network tab for failed API requests
  - Verify backend health: `curl http://192.168.0.32:3001/health`

### PATCH request fails with 403
- Guest trying to access another guest's RSVP
- Solution:
  - Verify the guest_id in the URL matches the logged-in user
  - Check session is not cleared between requests

## Quick Reference: Key Commits

| Commit | Issue | Fix |
|--------|-------|-----|
| 583860a | Missing auth.ts exports | Added fetchCurrentUser() export |
| 58608e8 | Cookie blocked by SameSite | Changed same_site="none" for dev |
| 46e6cd3 | Proxy not preserving cookies | Added cookieDomainRewrite config |
| fd3c39a | Type errors in tests | Fixed AuthUser import |
| 115859d | Documentation | Added fix summary |

## Files Modified

1. `production/frontend/src/api/auth.ts` - Added missing exports
2. `production/backend/app/main.py` - Fixed middleware config
3. `production/backend/app/api/tasks.py` - Fixed import
4. `production/frontend/vite.config.ts` - Improved proxy config
5. `SESSION_COOKIE_FIX_SUMMARY.md` - Documentation
