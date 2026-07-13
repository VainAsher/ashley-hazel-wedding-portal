# Email via SMTP/Resend (Wave 4 item 21)

## Decision (couple, 2026-07-13)
Add real email delivery for the `channel="email"` case in Communications.
Provider: **Resend** (recommendation, not yet confirmed by the couple which
account/domain specifics — code should work identically if they end up on a
different provider's SMTP later, since all provider-specific logic lives in
one function). WhatsApp/SMS remain **not built** (paid-provider territory,
recommended won't-do, unchanged from the existing admin-UI disclaimer).
Households/CSV import (items 20) are separately deferred/skipped per the
couple — not part of this spec.

Sender: `Ashley & Hazel <hello@ashley-and.hazel-of-halifax.com>` (assumption —
confirm exact address once the couple sets up domain verification in
Cloudflare; trivially changed via one env var either way).

## What already exists (do not rebuild)
- `Communication.channel` already has `'email'` in its CHECK constraint and
  the Pydantic validators (`schemas.py`).
- The admin Communications UI already has a channel picker
  (`admin/Communications.tsx`) wired to `channel: 'email'` by default.
- `send_communication()` (`app/api/communications.py`) already resolves
  `audience_invites()` and fans out one `Notification` row per recipient —
  this in-app delivery is unconditional and unchanged for every channel.
- `Guest.email` (nullable, format-checked, unique per wedding) is the only
  place an email address lives today — `Invite` itself carries no email
  column. Invites without a linked `Guest`, or a `Guest` whose `email` is
  NULL, cannot receive email; they still get the in-app notification as
  today.

## Schema
**No migration.** No new columns — email delivery is additive behavior in
`send_communication()`, not new state. (If the couple later wants a visible
"delivered to N of M" indicator in the admin UI, that would need a column —
explicitly deferred until asked for, per the "don't build for hypothetical
requirements" rule.)

## Config (`app/config.py`)
Two new settings, both required only when `channel="email"` is actually used
(don't hard-fail app startup if absent — most weddings' comms are
in-app/announcement only):
- `resend_api_key: str | None = Field(default=None)`
- `email_from_address: str = Field(default="Ashley & Hazel <hello@ashley-and.hazel-of-halifax.com>")`

Deploy: add `RESEND_API_KEY` to the same secret-transport path as
`POSTGRES_PASSWORD`/`JWT_SECRET` in `.github/workflows/deploy.yml` (env, blob,
decode-in-memory — follow the existing pattern exactly) once the couple
supplies a real key. Until then, email sending is code-complete but inert
(logs a warning and skips, per the failure-handling rule below) — this is the
one piece of the release that's genuinely blocked on the couple providing
credentials, not an engineering gap.

## Backend (`app/api/communications.py`)
- New helper `send_email_batch(recipients: list[tuple[str, str]], subject: str,
  html_body: str) -> int` (returns count actually accepted by Resend).
  `recipients` is `(email, display_name)` pairs. Uses `httpx` (already a
  dependency — no new package) to POST to Resend's batch endpoint
  (`https://api.resend.com/emails/batch`, up to 100 recipients per call — the
  entire guest list fits in one call at this wedding's size, so no chunking
  loop needed, but write it to chunk at 100 anyway so it doesn't silently
  break if the guest list grows).
- In `send_communication()`, after the existing in-app fan-out: if
  `db_communication.channel == "email"` and `settings.resend_api_key` is set,
  resolve each recipient invite's `Guest.email` (skip invites with no linked
  guest or no email on file — same invites that also can't receive RSVP
  reminders today), build one HTML body from `db_communication.subject` +
  `body`, and call `send_email_batch`.
- **Failure handling**: wrap the Resend call in try/except — a provider
  outage or missing API key must NOT fail the request or roll back the
  already-committed in-app notifications. Log a warning with the count
  attempted; the communication's `status` still becomes `"sent"` (in-app
  delivery, the channel that's actually guaranteed, did succeed). This
  mirrors the existing "best-effort, never block the primary path" pattern
  used for gallery thumbnail generation.
- Non-email channels (`announcement`, `whatsapp`, `sms`) behave exactly as
  today — in-app only, no change.

## Frontend
- `admin/Communications.tsx`: update the disclaimer copy near the channel
  picker — currently says "external channels (email, WhatsApp, SMS) are not
  connected yet"; change to "Email now delivers to guests with an email on
  file, in addition to the in-app notification. WhatsApp and SMS are not
  connected." No new UI controls needed — the channel picker and Send button
  already exist and already call the same endpoint.

## Tests
- Backend: `send_email_batch` unit-tested with a mocked `httpx` client (no
  real network calls in CI) — confirms correct payload shape, chunking at
  100, and that a non-2xx/exception response doesn't raise. Integration test
  on `send_communication`: channel="email" with `resend_api_key` set calls the
  mocked sender with the right recipient list (guests with email only,
  self-mentions... no wait, N/A here — just: invites with no guest or no
  guest.email are excluded); channel="email" with no `resend_api_key`
  configured skips sending but still returns 200 and still creates the
  in-app notifications; a simulated Resend failure (mocked to raise) doesn't
  propagate as a 500 and the communication still ends up `status="sent"`.
- No Playwright changes needed — nothing in the guest-facing UI changes; the
  admin flow is unchanged from the user's perspective (same button, quietly
  does more now).

## Out of scope
No email open/click tracking, no unsubscribe flow (not needed at this scale
per the roadmap's existing note), no scheduled-send execution (the
`scheduled_for` field already exists on `Communication` but nothing currently
polls it — out of scope for this item, flagged separately if the couple wants
it), no per-recipient delivery-status UI.
