# 06 — Delivery Plan and Acceptance

## 1. Delivery phases

### Phase 0 — Discovery and fit check

- Inspect current Wardogs website/repository and hosting.
- Confirm existing authentication, design system, domain, deployment, and analytics.
- Validate whether members should sign in to browse, submit, RSVP, or only to contribute.
- Confirm Steam and Discord link policy and public/member-only content boundaries.
- Produce a short implementation mapping and risk list.
- Inspect the current Knowledge Base repository, including `MASTER_INDEX.md`, article frontmatter, generated MkDocs configuration, and publish workflow; agree the canonical source and deployment route.
- Verify the current Wardogs/Steam friend-join flow with representative cases before selecting any direct-launch mechanism; distinguish game-supported joins from profile-link fallbacks.
- Confirm the 18+ self-attestation and whether UK focus is descriptive or an eligibility restriction.

**Exit:** Product owner approves scope mapping and any deviations from this pack.

### Phase 1 — Community core

- Responsive home, about/join, Discord and Steam links.
- Authentication and opt-in member profiles.
- Events and open-session creation/listing, RSVP, expiry, Steam host links.
- Squad finder filters, open/approval/friends-first policies, join requests, and a host Steam profile fallback.
- Private 18+ age attestation and `Europe/London` default timezone.
- Basic news/editorial capability.
- Admin management of community links and session permissions.

**Exit:** A member can find, post, and join a session flow; expired sessions stop appearing as open.

### Phase 2 — Knowledge library and moderation

- YouTube resource submission, preview, tags, search, detail page, embed.
- Add the Game Wiki navigation entry and integrate the existing generated KB (same-origin path if supported, otherwise branded wiki host/current URL).
- Preserve repository-controlled article metadata and citations; keep the wiki as a separately built static artifact.
- Trusted contributor direct publish.
- Report flow and moderator queue.
- Hide/restore/remove actions, role assignment, audit log, and basic notices.

**Exit:** Resource contribution and complete report-to-resolution journeys meet acceptance criteria below.

### Wiki integration release gate

- Generated MkDocs build is deployed from the approved KB repository workflow.
- Main navigation reaches the wiki on desktop and mobile, and wiki pages link back to the community hub.
- Wiki search works independently of community-resource search.
- Article citations, metadata, navigation, and patch caveat remain visible.
- A KB update can be deployed without an application database migration; an application release can proceed without rebuilding KB content.
- No local-only snapshot content or unapproved third-party raw text appears in the published wiki artifact.
- Preview/rollback steps identify the deployed KB commit/build.

### Phase 3 — Learning and community participation

- Written guides, drills, after-action reports, highlights, bookmarks/helpful signal.
- Contributor recognition, if the community wants it and criteria are agreed.
- Improved search and content freshness tools.

### Phase 4 — Server-ready expansion (conditional)

Only begin after the community confirms demand, funding, operational ownership, and moderation capacity. Add server page, operating rules, access process, status, schedule, and cost/continuity information only as applicable.

## 2. Acceptance criteria

### Join flow

- Visitor can identify the community’s purpose and reach configured Discord and Steam destinations from home and join page.
- At phone width, navigation and calls to action remain visible and usable.
- Copy does not imply that a private server is currently available.
- Public community copy clearly states that Wardogs UK is 18+ and UK-focused.

### Profiles

- Member can add/remove a Steam profile link and set profile visibility.
- Public/member-only views omit private fields and email.
- Member can change profile details without admin assistance.
- Member participation is blocked until private 18+ attestation is recorded; full date of birth and ID documents are not collected by default.

### Sessions

- Authorized member can create an open or scheduled session with required fields.
- Member can RSVP and change their response; duplicates are prevented.
- Session host Steam link opens the validated host profile in a new safe browsing context.
- Expired, cancelled, and hidden sessions are excluded from active session results.
- Unauthorized users cannot create/edit sessions by calling the API directly.
- A session may be open, host-approval, or Steam-friends-first; the interface describes the correct join steps.
- Join requests can be accepted, declined, withdrawn, and expired; duplicate active requests are prevented.
- Accepting a request never claims that a Steam friend request was sent or a Wardogs match was joined.
- A direct Steam/game handoff is enabled only after the compatibility spike verifies the exact link/launch behavior; otherwise the host profile/instructions fallback works.
- “Playing now” is member-posted, opt-in, and expires automatically; no Steam presence is inferred.

### Resource library

- Valid supported YouTube link produces a video preview or manual fallback.
- Invalid hosts/protocols are rejected with a useful message.
- Duplicate video IDs are identified before a second public entry is created.
- Trusted contributor can publish directly; a normal member follows the configured review path.
- Search by title/summary and filter by tags return only visible content.
- Embed does not autoplay; unavailable videos show a useful fallback and external link.

### Game Wiki

- Every main-site route has a persistent, clearly labeled Game Wiki link.
- Wiki landing page exposes all published catalogue entries from the current repository build; no static article count is hard-coded.
- Article display retains citation links and article-control metadata from the current source document.
- Search results distinguish Game Wiki documents from Community Guides and show game version/status/confidence where available.
- A wiki source update can be previewed and rolled back independently from the main site deployment.
- App database edits cannot change factual wiki articles or their source metadata.

### Reports and moderation

- Member can report a resource and select a reason.
- Reporter cannot see internal notes or another reporter’s identity.
- Moderator can review context, dismiss, edit, hide, restore, or remove an entry.
- Each action records actor, timestamp, target, action, and reason.
- A report alone does not automatically punish the contributor.
- Admin can change trusted contributor status; change requires authorization and produces an audit entry.
- Temporary restriction expires at the configured time without granting permissions back if another restriction remains active.

### Accessibility and operations

- Core flows are operable by keyboard and have labels announced by assistive technology.
- Empty, error, loading, success, and no-results states exist for key pages.
- Database backup and restore procedure is documented before production launch.
- Logs do not contain authentication secrets or unnecessary report/profile content.
- Public Game Wiki reading can remain available without age attestation; member-only actions enforce the 18+ attestation server-side.

## 3. Developer handoff checklist

- Repository/hosting discovery completed.
- UI wireframes or page-level component map reviewed.
- Role-permission matrix approved.
- Public/private field behavior approved.
- 18+ attestation and underage-report handling approved.
- UK focus scope (UK-oriented versus UK-resident eligibility) approved.
- Steam/Wardogs join compatibility spike completed and supported handoff/fallback documented.
- Tag taxonomy seed list approved.
- Knowledge Base deployment route and source-of-truth boundary approved.
- Wiki article feedback/correction route approved (GitHub issue/PR link or community form).
- Supported YouTube URL types and metadata method approved.
- Steam link validation behavior approved.
- Report retention, audit retention, and account deletion behavior approved.
- Error handling, backup, restore, and admin recovery documented.
- Deployment and rollback steps reviewed.

## 4. Suggested MVP tag taxonomy

Start with controlled groups and expand based on real submissions:

| Group | Initial values |
|---|---|
| Topic | Leveling, Cash earners, Builds, Base building, Squad tactics, Callouts, Weapons, Vehicles, Recon, Logistics |
| Audience | New player, Returning player, Squad leader |
| Format | Guide, Tutorial, Gameplay example, Review, Drill |
| Context | Game version/build, map, mode, faction (optional free-text or controlled list after discovery) |

Allow multiple tags from topic and one or more applicable values from other groups. Moderators own taxonomy changes.
