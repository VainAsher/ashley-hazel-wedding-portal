# 05 — Technical Architecture and Security

## 1. Architecture direction

Inspect the existing Wardogs website/repository before selecting a stack. Reuse its framework, deployment path, identity provider, component library, and monitoring where they meet these requirements. Avoid introducing a separate service unless a demonstrated need justifies the operational cost.

Logical components:

1. Responsive web application (public pages and authenticated member/admin views).
2. Application API/server actions enforcing authentication, authorization, and validation.
3. Relational database for members, resources, sessions, roles, reports, and audit records.
4. Optional background job for metadata refresh, expiry of sessions/temporary restrictions, and notifications.
5. External links/embeds to Discord, Steam, and YouTube; these are integrations, not sources of authority for member permissions.
6. A generated, static MkDocs Game Wiki built from the existing knowledge-base repository and deployed alongside or linked from the community application.

## 1A. Existing Game Wiki integration

The canonical source is [VainAsher/wardogs-game-knowledge-base](https://github.com/VainAsher/wardogs-game-knowledge-base). At review time, the repository describes an evidence-based, source-cited, unofficial WARDOGS reference. `MASTER_INDEX.md` is the document catalogue; article Markdown carries YAML metadata including stable ID, title, version, status, confidence, game version, updated/review dates, source verification date, relations, and tags. `scripts/build_site.py` generates `mkdocs.yml` and `docs/index.md`; the Pages workflow then builds MkDocs Material. Project status records 30 frozen documents at Season 02 / Update 0.2.0 and a dated 2026-10-30 snapshot. These counts and versions are time-bound and must be read from the repository at build/release time, not hard-coded into the app.

### Source-of-truth boundary

- Repository Markdown and its documented catalogue/research workflow own factual game articles.
- Generated MkDocs HTML is a deployable artifact, not an editable source.
- The community application's database owns sessions, profiles, reports, videos, and community-authored guides.
- A repository correction suggestion may be submitted through a GitHub issue/PR link or a site feedback form; a wiki maintainer reviews and commits it through the KB workflow.
- Never silently copy wiki articles into CMS records or treat a video submission as source-verified wiki material.

### Deployment options

Preferred experience: serve the generated wiki under the same site origin at `/wiki/`, preserving MkDocs navigation, search, article URLs, static assets, and citations. The developer must confirm path-prefix support and asset/canonical URL handling in the current host and MkDocs build.

If same-origin path hosting adds unnecessary complexity, use a branded wiki subdomain and reciprocal links; as an interim step keep the current published KB link in main navigation. Wiki and application may deploy independently. Do not make application availability depend on a wiki build or vice versa.

### Build and publish flow

1. A change to the KB source repository triggers its existing generation/build/validation pipeline.
2. Produce a preview artifact and verify links, search index, article paths, and visible metadata.
3. Publish the generated static artifact to the agreed `/wiki/` mount or wiki host from an approved repository state.
4. Publish the main app navigation link independently; keep a stable wiki base URL in configuration.
5. Optionally regenerate a read-only catalogue/cross-search index from the same commit and record the source commit/hash.

Do not hand-edit generated `mkdocs.yml` or `docs/index.md`; the repository identifies these as generated from the catalogue. Do not publish local-only snapshot text or other gitignored third-party captures; deploy only approved generated docs and artifacts.

### Wiki display requirements

Preserve in-article citations, document control table, confidence/status, game version, verification/review dates, related links, patch-sensitive caveats, and unofficial-reference notice. Avoid a wrapper that strips or obscures them. Do not inject the site's user-generated comments or edit controls into factual articles in the initial release.

## 2. Identity and account linking

- Reuse established authentication if the current site has it.
- If new auth is required, choose a supported provider after confirming account lifecycle, moderation needs, and user experience.
- Keep Discord/Steam profile links as optional profile attributes in MVP. Do not request platform credentials.
- If future OAuth linking is proposed, write a separate data-flow and consent design first, including scopes, token storage, unlinking, and deletion.
- Ensure account recovery and moderator/admin offboarding are documented.

## 3. Steam integration boundary

The community website can coordinate squad discovery and launch a supported external Steam/game action. It cannot itself create Wardogs joinability. Steamworks documents friend-to-game/lobby join callbacks and lobby invitations as behavior the game client must handle. See [ISteamFriends](https://partner.steamgames.com/doc/api/ISteamFriends) and [Steam Matchmaking & Lobbies](https://partner.steamgames.com/doc/features/multiplayer/matchmaking). Before promising direct joining, test whether the current Wardogs client exposes a reliable join route for the session types the community uses.

MVP is link- and listing-based, not friend-list API-integrated:

- Member enters or selects their Steam profile URL.
- Website validates and links to that profile.
- Session host may include a Steam link and plain-language join instructions.
- Website does not claim to know whether a person is online, in Wardogs, joinable, or currently hosting.
- Do not scrape Steam pages, automate friend requests, or import friend lists.

For an explicit **Join squad** action, the application records the user's join request/intent according to the session policy, then exposes a host Steam profile and clear instructions. A verified Steam/game URI or other supported join handoff may be used only after a compatibility spike confirms behavior for game-running and game-not-running cases. If the handoff fails, retain a profile/add-friend/instructions fallback.

True one-click joining from the community page depends on Wardogs' integration with Steam Rich Presence, a Steam lobby, or another supported join mechanism. The Steamworks APIs described in the linked documentation are game-side interfaces; an ordinary website cannot substitute for missing Wardogs client support. Steam sign-in, if later selected, can verify identity but must not be presented as permission to read friends/presence or issue game invites.

Any later integration must be checked against current Steam platform terms and provide clear user consent. Treat presence as sensitive behavioral information; keep it opt-in, minimal, and revocable.

### Rich Presence feasibility path

Steamworks documents `GetFriendRichPresence` and the special `connect`, `steam_player_group`, and `steam_player_group_size` values through the Steam client/game-facing `ISteamFriends` interface. Steam's enhanced Rich Presence model also describes game-defined activity details. These capabilities do not give an ordinary website direct access to a member's Steam client or friend list. See [ISteamFriends](https://partner.steamgames.com/doc/api/ISteamFriends) and [Enhanced Rich Presence](https://partner.steamgames.com/doc/features/enhancedrichpresence).

Before implementation, run a compatibility and policy spike against the current Wardogs build: determine which values Wardogs actually publishes, whether they describe the current player's own state or only friend-visible state, what access path is supported for a separate companion, and whether the game/platform permits relaying it to the community site. A local desktop companion is only a candidate; do not ship a scraper, undocumented memory reader, credential collector, or unsupported API workaround. If no supported path exists, retain member-posted availability and squad listings.

If the spike passes, use a narrowly scoped, explicitly launched companion with a clear sharing switch. Relay only a small allowlist of approved fields over authenticated TLS; do not store Steam passwords, session cookies, API keys, or raw Rich Presence maps. Keep current status ephemeral with a short TTL, member-only visibility by default, rate limits, immediate revoke/pause behavior, and no historical presence log. Direct join must use a separately verified game/Steam handoff and have a profile/instructions fallback. Detailed gameplay metrics (including financial values) are excluded unless separately justified and explicitly selected by the member.

## 4. Discord boundary

- Use invite links or approved public channel links configured by admins.
- Never expose private channel identifiers/invites unintentionally.
- Do not mirror Discord messages or member lists in MVP.
- If role sync or bot integration is considered later, document ownership, permissions, failure handling, and privacy before implementation.

## 5. YouTube metadata and embedding

- Accept allowlisted YouTube URLs and store canonical video ID and submitted URL.
- Retrieve title/thumbnail only through an approved method selected by the developer; allow manual entry when lookup fails.
- Do not download or rehost video/audio.
- Use a privacy-conscious embed option, no autoplay, and a click-to-load placeholder if feasible.
- Provide an external YouTube link and handle deleted, private, age-restricted, or region-blocked videos gracefully.
- Avoid sending unnecessary member identity or search terms to third-party services.
- Cache metadata only as needed and provide a refresh or correction path for moderators.

## 6. Security controls

- Enforce access checks server-side on every protected endpoint/action.
- Apply least privilege and separate moderator from administrator capabilities.
- Require private 18+ self-attestation before account participation; keep public wiki pages independently accessible if configured.
- Protect state-changing forms against CSRF where applicable; use secure, HttpOnly, SameSite cookies if cookie sessions are used.
- Validate inputs server-side; escape output; defend against XSS, SQL injection, SSRF, open redirects, and unsafe Markdown.
- Restrict external URL hosts and protocols for Steam/YouTube links.
- Rate limit sign-in attempts, submissions, reports, and session creation.
- Use secure password handling only if passwords are managed directly; prefer a maintained identity provider.
- Keep secrets out of source control and client bundles.
- Log security-relevant actions without storing tokens or unnecessary sensitive data.
- Provide a moderator/admin account recovery and emergency role-revocation process.

## 7. Privacy and data handling

- Public profile is opt-in; disclose which fields are public.
- Do not publish email, account identifiers, report identities, internal notes, or moderation history.
- Explain retention for reports, audit events, removed resources, and deleted accounts.
- Provide profile edit, unlink, export/request, and deletion pathways appropriate to the selected legal and operational context.
- Collect only data necessary to coordinate sessions and organize resources.
- For 18+ eligibility, record only the attestation and policy version/time needed for membership administration. Do not collect full date of birth or identity documents by default.
- Avoid precise availability schedules; free-text or broad availability is safer and easier to maintain.
- Provide a privacy notice before launch and identify the operator/contact route.

## 8. Reliability and operations

- Automated backups for the database and user-created content; document restore steps.
- Health monitoring for the site and database.
- Error reporting with redaction of profile fields, tokens, and report details.
- Staging environment for schema/content changes.
- Migration process with rollback plan.
- Retain audit log integrity and protect logs from ordinary moderator alteration.
- Set operational limits and alerting for report queue backlog and failed background jobs.

## 9. Performance and accessibility

- Optimize images and lazy-load video embeds.
- Paginate large lists and use server-side filtering.
- Avoid loading third-party video scripts before the user interacts where practical.
- Use semantic HTML, accessible labels, keyboard navigation, visible focus, reduced-motion support, and sufficient color contrast.
- Test core flows on small-screen layouts and with keyboard-only navigation.

## 10. Environment configuration

Admin-configurable values should include Discord invite, Steam group link, site name/branding, resource tag taxonomy, allowed URL hosts, session default expiry, and feature flags. Keep secrets and environment-specific values outside content records and version control.

Also configure the wiki base URL/path, repository URL, optional issue/correction URL, current published KB commit/build identifier, and whether cross-site search is enabled. These are public configuration values; no GitHub write token belongs in the browser or application runtime for read-only integration.
