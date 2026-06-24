# Backend Security Operations

## Secret Handling Rules

- Never commit `.env`, real guest data, exported spreadsheets, database dumps, or private keys.
- Never paste credentials into issue comments, PR descriptions, logs, screenshots, or chat.
- Keep secrets in environment variables or the ignored `production/backend/.env` file for development.
- Use `.env.example` only for placeholders.
- Treat database URLs, API keys, JWTs, passwords, and access tokens as secrets.

## Credential Rotation Procedure

### Database Password Rotation

1. Generate a new password on the target host:

   ```bash
   openssl rand -base64 32
   ```

2. Apply the new password in PostgreSQL during a planned maintenance window:

   ```sql
   ALTER USER wedding_dev WITH PASSWORD '<new-password>';
   ```

3. Update the runtime environment without committing it:

   ```bash
   cd ~/wedding-dashboard/production/backend
   $EDITOR .env
   ```

   Update only the password portion of `DATABASE_URL`.

4. Verify the new credential before restart:

   ```bash
   source .env
   venv/bin/python scripts/verify_database_url.py
   ```

5. Restart the backend and verify health:

   ```bash
   pkill -f "python main.py"
   nohup venv/bin/python main.py > /tmp/wedding-dashboard-backend.log 2>&1 < /dev/null &
   curl -sS http://localhost:3001/health        # liveness (does not touch DB)
   curl -sS http://localhost:3001/health/ready   # readiness (verifies DB; 503 if unreachable)
   ```

   After a credential change, prefer `/health/ready` to confirm the backend can
   actually reach the database with the new password — `/health` will report
   healthy even when the DB is unreachable.

6. Confirm old credentials no longer work, then remove them from any password manager or rollback note after the maintenance window closes.

### API Key Rotation

1. Generate the replacement key in the provider console.
2. Add the new key to the environment.
3. Deploy and verify requests using the new key.
4. Revoke the old key.
5. Check logs for authentication failures.

### JWT Secret Rotation

Changing a JWT secret invalidates existing sessions. Rotate only during planned maintenance or incident response.

1. Generate a new strong random secret.
2. Update the runtime environment.
3. Restart the backend.
4. Require users to sign in again.

## Deployment Security Checklist

- [ ] `.env` exists only on the host and is ignored by git.
- [ ] `DATABASE_URL` is supplied by the runtime environment.
- [ ] No real password, API key, JWT, or token appears in git diff output.
- [ ] `python -m pytest tests -q` passes.
- [ ] `scripts/verify_database_url.py` passes on the deployment host.
- [ ] CORS origins match the target environment.
- [ ] Security headers are present on `/health`.
- [ ] Backend logs do not include full database URLs or secret values.
- [ ] Credential changes are recorded in the operational log without plaintext secrets.
