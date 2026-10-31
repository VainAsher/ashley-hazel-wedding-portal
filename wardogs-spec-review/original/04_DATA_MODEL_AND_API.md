# 04 — Data Model and API

This is a logical model, not a mandate for a particular ORM or database. A relational database is recommended because content, tags, memberships, reports, and permissions have clear relationships.

## 1. Core entities

### User

- `id` (UUID/opaque ID)
- `auth_subject` (unique identity-provider key)
- `display_name`
- `email` (only if needed for account operations; not public)
- `status` (active, restricted, suspended, deleted)
- `age_attested_at` (timestamp; private; null until attested)
- `age_policy_version` (policy text/version the member accepted)
- `timezone` (default `Europe/London`; member editable)
- `created_at`, `updated_at`, `last_seen_at` (avoid showing last-seen publicly)

Do not add `date_of_birth` or identity-document fields for MVP. The age attestation is an eligibility record, not a public profile attribute.

### Profile

- `user_id` (one-to-one)
- `bio`, `avatar_url`
- `preferred_roles[]` or relation to controlled role taxonomy
- `experience_band`
- `availability_text` or structured schedule (optional)
- `open_to_invites` (boolean, optional)
- `broad_play_windows` (coarse choices such as weekday evenings/weekends)
- `visibility` / field visibility settings
- `steam_profile_url` (optional)
- `discord_handle_or_url` (optional; explain privacy and platform changes)
- `profile_updated_at`

Store Steam profile URL as member-supplied data. Do not store Steam credentials, access tokens, friend lists, or presence data in MVP.

Future presence sharing is feasibility-gated and off by default. If approved, model the member's consent separately from an ephemeral status snapshot. Keep snapshots short-lived, audience-scoped, and minimal; do not persist arbitrary Rich Presence key/value pairs or retain snapshots as activity history. Revoke/delete must clear the current snapshot promptly. A local companion proposal must be reviewed for platform policy, client security, and deployment before implementation.

### Role, Permission, UserRole

- `Role(id, key, name, description, assignable_by, is_system)`
- `Permission(id, key, description)`
- `RolePermission(role_id, permission_id)`
- `UserRole(user_id, role_id, granted_by, reason, granted_at, expires_at, revoked_at, revoked_by)`

Use stable permission keys in code and database; role names may change.

### Session / Event

- `id`, `created_by`, `host_user_id`
- `kind` (ad_hoc, scheduled_event)
- `title`, `description`, `activity_type`
- `starts_at`, `ends_at`, `expires_at` (UTC; render local time)
- `capacity` (nullable), `visibility` (public, members)
- `host_steam_profile_url` (nullable; normalized from a validated Steam profile URL)
- `join_handoff_kind` (optional enum; none, game_launch, lobby, server; populated only after compatibility is verified)
- `join_handoff_reference` (nullable; opaque/validated game-specific target; never accept an arbitrary URI from a member)
- `join_policy` (open, host_approval, steam_friends_first)
- `discord_location` (nullable; avoid posting private invite tokens publicly)
- `status` (open, full, cancelled, expired, hidden)
- `created_at`, `updated_at`

RSVP relation: `SessionRsvp(session_id, user_id, response, created_at, updated_at)`; unique `(session_id,user_id)`.

### SessionJoinRequest

- `id`, `session_id`, `requester_user_id`, `host_user_id`
- `state` (requested, accepted, declined, withdrawn, expired)
- `message` (optional, length-limited)
- `created_at`, `updated_at`, `expires_at`

Unique active request per `(session_id,requester_user_id)`. Acceptance means the host has agreed to the member joining the squad; it does not mean Steam has added them as a friend or that Wardogs has connected them to a match. The accepted response can expose the host-provided Steam link and join instructions.

### Resource

- `id`, `created_by`, `updated_by`
- `kind` (youtube_video, written_guide)
- `title`, `summary`, `canonical_url`
- `youtube_video_id` (nullable, unique when present)
- `thumbnail_url` (prefer controlled known provider URL or cached metadata only if policy permits)
- `game_version`, `map`, `mode`, `faction` (nullable)
- `status` (draft, pending, published, needs_review, outdated, hidden, removed)
- `visibility` (public, members)
- `published_at`, `created_at`, `updated_at`, `reviewed_at`
- `reviewed_by`, `moderation_reason` (reference to moderation case/action, not unrestricted public text)

### Tag and ResourceTag

- `Tag(id, key, label, group_key, description, active, created_by, updated_at)`
- `ResourceTag(resource_id, tag_id, added_by, created_at)`

Tag groups may include topic, role, difficulty, activity, and format. Configure allowed groups and maximum tags per resource.

### Report and ModerationAction

- `Report(id, reporter_user_id, target_type, target_id, reason_key, explanation, status, created_at, resolved_at, resolved_by)`
- `ModerationCase(id, target_type, target_id, state, priority, assigned_to, created_at, updated_at, closed_at)`
- `CaseReport(case_id, report_id)`
- `ModerationAction(id, case_id, actor_user_id, action_key, reason, before_json, after_json, created_at, expires_at)`
- `AuditEvent(id, actor_user_id, event_key, target_type, target_id, reason, before_json, after_json, correlation_id, created_at)`

Avoid collecting reporter information beyond what is needed to prevent abuse and handle the case. Define retention and access controls.

### News / Highlight (M1)

May use a shared editorial `ContentEntry` entity, or separate tables if workflows diverge. Include author, status, publish schedule, title, body, media references, and visibility.

### Wiki catalogue projection (optional, M1)

The wiki is delivered as a generated static site, so its articles do not need application database rows. If the main site needs cross-search or article cards, build a read-only projection from the repository's generated catalogue/manifest at build time:

- `WikiDocument(id, title, path, category, topic, tier, market, version, status, confidence, game_version, updated_at, review_due, sources_verified, related_ids, summary, content_hash, source_commit)`
- `WikiSearchIndex` may be generated from article text and metadata; it is disposable and rebuilt from the repository.
- A community guide may link to a stable wiki document ID; resolve the current deployed path at build time rather than storing display titles as identifiers.

Do not let CMS edits mutate this projection or write changes back to the repository. Community members can propose corrections through a repository issue/PR link or a moderated feedback form; maintainers decide whether to update factual source documents.

## 2. Relationships and constraints

- A user has one profile and may have multiple roles.
- A session has one creator/host and multiple RSVPs.
- A resource has one creator, optional reviewer, and many tags.
- A YouTube video ID should be unique among non-removed resources to reduce duplicates.
- A report target must resolve to an allowed entity type and existing record.
- Moderation and audit records should survive ordinary content removal for their configured retention period.
- Database constraints must enforce uniqueness and valid status values where feasible.

## 3. API shape (illustrative)

Use the existing application’s conventions if present. All write endpoints require authenticated identity and server-side permission checks. Return stable IDs, status, and validation errors.

### Public/member reads

- `GET /api/resources?q=&tags=&kind=&status=published&sort=`
- `GET /api/resources/{id}`
- `GET /api/sessions?state=open|upcoming|past&activity=&from=&to=`
- `GET /api/sessions/{id}`
- `GET /api/members/{slug}` (only fields permitted by profile visibility)
- `GET /api/events` (may be unified with sessions using `kind`)
- Wiki pages themselves are static routes, not API-owned content. Optional `GET /api/wiki/catalogue` exposes a read-only catalogue/search projection only if cross-search or related-content widgets require it.

### Writes

- `POST /api/resources` — submit draft/pending/published depending on role.
- `PATCH /api/resources/{id}` — owner or authorized editor; enforce ownership and state transitions.
- `POST /api/resources/{id}/reports`
- `POST /api/sessions` / `PATCH /api/sessions/{id}` / `POST /api/sessions/{id}/rsvp`
- `POST /api/sessions/{id}/join-requests` and host-only accept/decline actions
- `POST /api/sessions/{id}/reports`
- `PATCH /api/profile` — own profile fields only.
- `POST /api/moderation/cases/{id}/actions` — moderator/admin only.
- `POST /api/admin/users/{id}/roles` and `DELETE` equivalent — administrator or delegated role manager only; require reason.

### Error behavior

- `400` malformed request, `401` unauthenticated, `403` unauthorized, `404` unavailable/not visible, `409` duplicate/conflicting state, `422` validation error, `429` rate limited.
- Do not disclose whether a private member/profile exists when caller lacks access.
- Return field-level validation errors suitable for form display.

## 4. Validation rules

- YouTube parser accepts only HTTPS links for allowlisted YouTube domains and extracts a valid video ID. Reject playlists/channels unless explicitly supported.
- Steam URL parser allows known Steam community profile URL forms only; reject `javascript:`, data URLs, arbitrary redirects, and malformed hostnames.
- Do not accept a member-supplied `steam://` join URI. If a supported join handoff is verified, generate it server-side from the configured Wardogs App ID and validated session target; otherwise expose the Steam profile link and instructions.
- Sanitize rendered text and use safe Markdown rules if Markdown is allowed.
- Limit title, summary, bio, and explanation lengths.
- Validate event/session times, expiry, and capacity bounds.
- Block member participation unless an 18+ attestation is present; do not return attestation timestamp/version in public profile payloads.
- Require controlled tags; free-form tags are not public by default.
- Use idempotency or duplicate checks on submission and RSVP operations where appropriate.

## 5. Search and indexing

Initial search may use database full-text search over title and summary plus exact tag filters. Keep resource data in a shape that can later be indexed by a dedicated search service if scale requires it. Search must exclude hidden, removed, pending, and private content from callers without permission.

Keep the wiki's MkDocs search index as the authoritative in-wiki search. A cross-site search index is derived from the published build or repository catalogue and regenerated with each wiki release. Index and present source type, game version, confidence/status, and update metadata. Never rank a user-generated guide so that it appears to be an official or verified fact page.

## 6. State transitions

### Resource

- Member submit: `draft → pending` (if enabled)
- Trusted publish: `draft → published`
- Moderator: `published → needs_review | outdated | hidden | removed`
- Moderator/admin: `hidden → published | outdated | removed`
- Admin only: `removed → purged` after retention and policy checks

### Session

- `open → full | cancelled | expired | hidden`
- `full → open` if capacity changes or RSVP is removed
- `hidden → open/full/cancelled` by moderator/admin restoration

Keep transitions explicit and audited. Avoid accepting arbitrary status changes from clients.
