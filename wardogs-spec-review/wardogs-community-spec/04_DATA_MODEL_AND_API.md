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
- `steam_id64` (nullable; set only through Steam sign-in/account linking in a later release, never typed by the member; shown as “verified via Steam”)
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

A single entity covers squad listings and scheduled events; `listing_type` distinguishes them and maps one-to-one to the listing types in `09` §4.

- `id`, `created_by`, `host_user_id`
- `listing_type` (scheduled_squad, looking_for_players, playing_now, training_event)
- `title`, `description`, `activity_type`, `mode` (nullable; controlled list after discovery)
- `starts_at` (UTC; null means “now” for playing_now), `duration_minutes` (nullable), `ends_at` (nullable; derived or entered), `expires_at` (UTC; required)
- `timezone` (IANA name used for display; default `Europe/London`)
- `capacity` (nullable = no fixed limit; otherwise total places including host)
- `roles_wanted[]` (controlled role taxonomy), `experience_expectation` (controlled band or “any”)
- `voice_coordination` (enum: discord, in_game, none, other) and `discord_location` (nullable; avoid posting private invite tokens publicly)
- `learning_goals`, `preparation_notes` (nullable; training_event only)
- `visibility` (public, members)
- `join_policy` (open, host_approval, steam_friends_first)
- `accepts_new_steam_friends` (boolean; used by the squad-finder filter and shown for steam_friends_first)
- `host_steam_profile_url` (nullable; normalized from a validated Steam profile URL; disclosure governed by the matrix below)
- `join_instructions` (nullable, length-limited plain text; disclosure governed by the matrix below)
- `join_handoff_kind` (optional enum; none, game_launch, lobby, server; populated only after compatibility is verified)
- `join_handoff_reference` (nullable; opaque/validated game-specific target; never accept an arbitrary URI from a member)
- `status` (open, full, cancelled, expired, hidden)
- `closed_by_host` (boolean; true when the host marked the session full manually)
- `created_at`, `updated_at`

Defaults: `playing_now` and `looking_for_players` expire four hours after creation unless the host sets an earlier time (hard maximum configurable, default 12 hours). Scheduled squads and training events expire at `ends_at`, or `starts_at` + `duration_minutes`, or `starts_at` + 4 hours if neither is set.

RSVP relation (training events and scheduled squads that use RSVP): `SessionRsvp(session_id, user_id, response, created_at, updated_at)`; unique `(session_id,user_id)`; response is attending, interested, or unable.

### Seat counting

A seat is taken by the host, each `SessionJoinRequest` in state `accepted`, and each `attending` RSVP on a session that uses RSVP instead of join requests. A session uses one mechanism, not both: squad listings use join requests; training events may use either, selected by the host.

- When seats taken reach `capacity`, the server sets `status = full`.
- When an accepted request is withdrawn, an attending RSVP changes, or capacity increases, the server sets `full → open` if seats are available and `closed_by_host` is false. A host-closed session stays full until the host reopens it.
- Seat counts are computed server-side in the same transaction as the triggering change to prevent overbooking.

### SessionJoinRequest

- `id`, `session_id`, `requester_user_id`, `host_user_id`
- `state` (requested, accepted, declined, withdrawn, expired)
- `decided_by` (host, moderator, or `system` for open-policy auto-accept), `decided_at`
- `message` (optional, length-limited)
- `created_at`, `updated_at`, `expires_at` (equals the session's `expires_at`)

Unique active request (`requested` or `accepted`) per `(session_id,requester_user_id)`.

- **Open policy:** “Join squad” creates a request that the server immediately sets to `accepted` with `decided_by = system`, if a seat is available. This gives open sessions the same seat counting, withdrawal, and notification behavior.
- **Host approval and Steam-friends-first:** the request stays `requested` until the host accepts or declines.
- If the session becomes full, cancelled, expired, or hidden, open `requested` items move to `expired` (or stay `requested` while the session is merely full, at the host's option).

Acceptance means the host has agreed to the member joining the squad; it does not mean Steam has added them as a friend or that Wardogs has connected them to a match.

### Host-detail disclosure matrix

The API returns host contact fields according to the caller's state. Enforce this server-side in every session read, including list endpoints.

| Field | Anonymous visitor (public sessions only) | Signed-in, attested member | Requester with `accepted` request | Host / moderator |
|---|---|---|---|---|
| Title, activity, mode, time, places, roles wanted, join policy, voice type | Yes | Yes | Yes | Yes |
| Host display name | Only if the host's profile is public; otherwise “Wardogs UK member” | Yes | Yes | Yes |
| `host_steam_profile_url` | No | Yes for open and steam_friends_first; **No** for host_approval | Yes | Yes |
| `join_instructions`, `discord_location` | No | No (revealed once the member's request is accepted, which is immediate for open sessions with a free place) | Yes | Yes |
| Verified join handoff | No | No (same rule) | Yes | Yes |
| Requester list and messages | No | No | Own request only | Yes |

Signed-in users who have not completed the 18+ attestation are treated as anonymous visitors for this matrix. `visibility = members` sessions are not returned to anonymous callers at all. A host may make a session public only if they accept that the activity summary is visible to visitors; the creation form must say so.

### Resource

- `id`, `created_by`, `updated_by`
- `kind` (youtube_video, written_guide)
- `title`, `summary`, `canonical_url`
- `youtube_video_id` (nullable; unique among resources not in `removed` or `rejected` status, e.g. via a partial unique index)
- `thumbnail_url` (prefer controlled known provider URL or cached metadata only if policy permits)
- `game_version`, `map`, `mode`, `faction` (nullable)
- `status` (draft, pending, rejected, published, needs_review, outdated, hidden, removed)
- `visibility` (public, members)
- `published_at`, `created_at`, `updated_at`, `reviewed_at`, `removed_at` (starts the restore/retention window)
- `reviewed_by`, `moderation_reason` (reference to moderation case/action, not unrestricted public text)

“Purged” is not a stored status: purge deletes the resource row and its tags, leaving only the minimum audit/moderation record allowed by the retention policy. See §6 for the authoritative lifecycle.

### Tag and ResourceTag

- `Tag(id, key, label, group_key, description, active, created_by, updated_at)`
- `ResourceTag(resource_id, tag_id, added_by, created_at)`

Tag groups may include topic, role, difficulty, activity, and format. Configure allowed groups and maximum tags per resource.

### Report and ModerationAction

- `Report(id, reporter_user_id, target_type, target_id, reason_key, explanation, status, created_at, resolved_at, resolved_by)`
  - `target_type`: resource, session, profile, content_entry (news/highlight); comment only if comments are added later.
  - `reason_key`: broken_link, incorrect_or_outdated, wrong_tags_or_duplicate, spam, harassment_or_inappropriate, privacy_or_safety, eligibility_18_plus (restricted visibility), other.
  - `status`: open, merged, resolved_dismissed, resolved_actioned, escalated.
- `ModerationCase(id, target_type, target_id, state, priority, assigned_to, created_at, updated_at, closed_at)`
- `CaseReport(case_id, report_id)`
- `ModerationAction(id, case_id, actor_user_id, action_key, reason, before_json, after_json, created_at, expires_at)`
- `AuditEvent(id, actor_user_id, event_key, target_type, target_id, reason, before_json, after_json, correlation_id, created_at)`

Avoid collecting reporter information beyond what is needed to prevent abuse and handle the case. Define retention and access controls.

### UserRestriction

- `UserRestriction(id, user_id, capabilities[] (permission keys removed, e.g. resource.publish_direct, session.create), scope (all or a target type), reason, case_id (nullable), created_by, starts_at, ends_at (nullable = until lifted), lifted_at, lifted_by, lift_reason)`

Effective permissions are computed at request time: the union of permissions from active, unexpired `UserRole` rows, minus the union of capabilities in every active `UserRestriction` (`starts_at ≤ now`, not lifted, `ends_at` null or in the future). One restriction expiring therefore never restores a capability that another active restriction still removes. Account-wide suspension is modelled as `User.status = suspended`, which overrides all roles. Creating, extending, or lifting a restriction writes an `AuditEvent` and a `Notification` to the member.

### Notification

- `Notification(id, recipient_user_id, kind, subject_type, subject_id, title, body, created_at, read_at, delivered_channels[])`
- `kind` examples: join_request_received, join_request_accepted, join_request_declined, session_cancelled, content_changed_by_moderator, content_hidden, content_removed, restriction_applied, restriction_lifted, role_granted, role_revoked, report_resolved (reporter, optional).

MVP delivers notifications in the site only (a notifications list and unread count). Email or Discord delivery is a later, opt-in addition with its own consent setting. Notification text must not reveal reporter identity or private moderator notes. Notifications follow the same retention schedule as other account data and are deleted with the account.

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
- A session has one creator/host and multiple RSVPs or join requests (one mechanism per session; see *Seat counting*).
- A user may have multiple restrictions; restrictions and notifications belong to one user.
- A resource has one creator, optional reviewer, and many tags.
- A YouTube video ID is unique among resources not in `removed` or `rejected` status, to reduce duplicates without blocking resubmission after removal.
- A report target must resolve to an allowed entity type and existing record.
- Moderation and audit records should survive ordinary content removal for their configured retention period.
- Database constraints must enforce uniqueness and valid status values where feasible.

## 3. API shape (illustrative)

Use the existing application’s conventions if present. All write endpoints require authenticated identity and server-side permission checks. Return stable IDs, status, and validation errors.

### Public/member reads

- `GET /api/resources?q=&tags=&kind=&status=published&sort=`
- `GET /api/resources/{id}`
- `GET /api/sessions?state=open|upcoming|past&listing_type=&activity=&mode=&role=&experience=&voice=&policy=&new_friends=&min_places=&from=&to=` (response fields follow the disclosure matrix)
- `GET /api/sessions/{id}`
- `GET /api/members/{slug}` (only fields permitted by profile visibility)
- `GET /api/events` (may be unified with sessions by filtering `listing_type=scheduled_squad,training_event`)
- Wiki pages themselves are static routes, not API-owned content. Optional `GET /api/wiki/catalogue` exposes a read-only catalogue/search projection only if cross-search or related-content widgets require it.

### Writes

- `POST /api/resources` — submit draft/pending/published depending on role.
- `PATCH /api/resources/{id}` — owner or authorized editor; enforce ownership and state transitions.
- `POST /api/reports` — body `{target_type, target_id, reason_key, explanation}`; one endpoint for every reportable target (resource, session, profile, content_entry). Returns `404` if the caller cannot see the target.
- `POST /api/sessions` / `PATCH /api/sessions/{id}` / `POST /api/sessions/{id}/rsvp`
- `POST /api/sessions/{id}/cancel`, `POST /api/sessions/{id}/close`, and `POST /api/sessions/{id}/reopen` — host or moderator; `close` marks the session full regardless of seats (`closed_by_host = true`); `reopen` clears it and recalculates seats.
- `POST /api/sessions/{id}/join-requests` — creates a request (auto-accepted for open policy if a seat is free).
- `POST /api/join-requests/{id}/accept` and `/decline` — host (or moderator) only.
- `POST /api/join-requests/{id}/withdraw` — requester only; frees the seat if it was accepted.
- `GET /api/sessions/{id}/join-requests` — host/moderator; `GET /api/me/join-requests` — caller's own.
- `PATCH /api/profile` — own profile fields only.
- `GET /api/me/notifications` and `POST /api/me/notifications/{id}/read`.
- `POST /api/moderation/restrictions` / `POST /api/moderation/restrictions/{id}/lift` — moderator (limited scope) or administrator; reason required.
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

Initial search may use database full-text search over title and summary plus exact tag filters. Keep resource data in a shape that can later be indexed by a dedicated search service if scale requires it. Search must exclude draft, pending, rejected, hidden, removed, and private content from callers without permission.

Keep the wiki's MkDocs search index as the authoritative in-wiki search. A cross-site search index is derived from the published build or repository catalogue and regenerated with each wiki release. Index and present source type, game version, confidence/status, and update metadata. Never rank a user-generated guide so that it appears to be an official or verified fact page.

## 6. State transitions

### Resource (authoritative lifecycle; `03` §5 summarizes it)

- Member submit: `draft → pending` (if pending review is enabled)
- Trusted publish: `draft → published`
- Reviewer (editor/moderator): `pending → published | rejected` (rejection requires a reason and notifies the contributor; the contributor may edit and resubmit `rejected → pending`)
- Moderator: `published → needs_review | outdated | hidden | removed`
- Moderator/editor: `needs_review → published | outdated | hidden | removed`; `outdated → published` (after correction) `| hidden | removed`
- Moderator/admin: `hidden → published | outdated | removed`
- Admin only, within the retention window: `removed → published | hidden` (restore)
- Admin only, after retention and policy checks: `removed → purged` (row deletion, see Resource)
- Owner: may withdraw their own entry to `removed` (“remove from library”); the retention notice applies.

### Session

- `open → full | cancelled | expired | hidden`
- `full → open` when seats become available and the host has not closed it, or when the host reopens it (see *Seat counting*)
- `full → cancelled | expired | hidden`
- `hidden → open | full | cancelled` by moderator/admin restoration (or `expired` if `expires_at` has passed)
- A background job (or read-time check) moves sessions past `expires_at` to `expired`; cancelling or expiring a session moves its open join requests to `expired`.

### Join request

- `requested → accepted | declined | withdrawn | expired`
- `accepted → withdrawn` (requester), `→ declined` (host removes the member, with an optional note), or `→ expired` (session ends or is cancelled)

Keep transitions explicit and audited. Avoid accepting arbitrary status changes from clients.
