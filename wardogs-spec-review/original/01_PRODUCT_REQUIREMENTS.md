# 01 — Product Requirements

## 1. Vision

Give Wardogs community members a clear route from discovering the group to playing, learning, and contributing. Build a useful website before the community has a private server, with room to add server operations later.

## 2. Current context and assumptions

- The community has a growing Discord and a small Steam group.
- Wardogs UK is a UK-based, UK-focused community for adults aged 18 and over, intended to help and encourage members to group up in game.
- Members use Steam friends to locate and join each other in game.
- No private Wardogs server is currently operated by the community.
- The community wants organized YouTube resources for subjects such as leveling, cash earners, builds, base building, and squad tactics.
- Trusted contributors should be able to publish immediately; moderation must support reports, reversible removal, role changes, and a record of actions.
- The VainCraft website is a reference for information architecture and branded community features, not a binding technical or content template.
- No preferred technology stack, identity provider, domain plan, budget, or launch date has been confirmed.

## 3. Product goals

1. Help a new visitor understand the community and join Discord or Steam.
2. Make it easier for members to find a session and join its host through Steam.
3. Make useful videos and guides findable after the original Discord conversation is gone.
4. Support regular play, events, and training without requiring a private server.
5. Let members contribute while giving moderators effective, accountable controls.
6. Provide a stable structure that can grow without promising a server or expensive features prematurely.
7. Make the existing Wardogs Game Knowledge Base easy to discover as the site's factual, source-cited game wiki, without creating a competing copy of its articles.
8. Reduce the steps from finding a suitable squad to joining its Wardogs session, using supported Steam/game handoffs where available.

## 4. Non-goals for initial release

- Hosting Wardogs game servers or managing game-server access.
- Reading Steam friend lists, presence, game activity, or account data without a specifically approved integration and consent model.
- Recreating Discord chat, voice, or a full social network.
- Automated skill rankings, public competitive rating, or punitive reputation scores.
- Payments, donations, fundraising, or server investment commitments.
- User-uploaded video files. Video playback is embedded from YouTube.
- Real-time game telemetry or automatic match statistics where no reliable source is established.
- Direct Steam friend-list access, automated friend requests, or guaranteed in-game joins unless a supported Wardogs/Steam mechanism is confirmed and approved.

## 5. Users and needs

### Visitor / prospective member

Needs to understand what Wardogs community offers, how to join, expectations for conduct, and which links lead to Discord and Steam.

### Member

Needs to discover upcoming play sessions, find people to add on Steam, browse useful resources, and control what profile information is shown.

### Trusted contributor

Needs to publish videos, guides, sessions, and highlights with low friction; correct their own entries; and receive clear moderation feedback.

### Moderator

Needs to triage reports, hide or restore content, correct tags, handle repeated problems consistently, and see an audit trail.

### Administrator / owner

Needs to manage roles, permission grants, taxonomies, community links, settings, and account access, with least privilege and recoverable changes.

## 6. Information architecture

Recommended top-level navigation:

- **Home** — purpose, current call to action, next sessions, recent resources/highlights.
- **Play Together** — upcoming events, open sessions, host Steam links, RSVP.
- **Learn** — video library, written guides, drills, and topic filters.
- **Community** — news, highlights, after-action reports (later), member-created content.
- **Members** — opt-in public profiles and community team.
- **About** — community principles, moderation/reporting, contact and join links.

Do not show empty sections as if they are active. Hide or mark unfinished modules as coming later only when that helps members understand the roadmap.

## 7. Functional requirements

Priority legend: **M0** launch-critical; **M1** valuable soon after launch; **M2** future capability.

### Join and community identity

- **FR-001 (M0):** Home page explains the Wardogs community in plain language.
- **FR-002 (M0):** Discord and Steam group links are prominent, labeled, and configurable by an administrator.
- **FR-003 (M0):** A newcomer page explains how sessions work, expected conduct, voice/comms expectations, and how to join through Steam.
- **FR-004 (M0):** Mobile pages provide usable navigation and clear calls to action.
- **FR-005 (M0):** Community membership and member-only participation are for people aged 18+. Registration requires an explicit age attestation; public wiki/reference pages may remain readable without an account. Do not collect full date of birth or identity documents by default.
- **FR-006 (M0):** Public copy identifies the community as UK-based and UK-focused. Event times default to Europe/London with visitor-local display and an explicit timezone label.

### Accounts and profiles

- **FR-010 (M0):** Members can authenticate through the chosen account mechanism; implementation choice is pending.
- **FR-011 (M0):** Members can maintain a profile with display name, optional avatar, short bio, preferred roles, experience band, availability, and optional Discord/Steam links.
- **FR-012 (M0):** Each profile field is either public, member-only, or private according to a documented default and user control.
- **FR-013 (M0):** Linking a Steam profile is optional and must not be required for browsing public material.
- **FR-014 (M0):** Members can edit or remove their profile and request account deletion.
- **FR-015 (M0):** Member profiles can include opt-in squad-finder fields: preferred roles, broad play windows, experience band, and whether they are open to invites. Do not expose precise schedules by default.

### Events and play sessions

- **FR-020 (M0):** Authorized users can create a scheduled community event with title, description, start/end time, timezone, activity type, host, capacity (optional), expectations, and links.
- **FR-021 (M0):** Members can RSVP as attending, interested, or unable to attend; event hosts/moderators can see the attendee list according to privacy settings.
- **FR-022 (M0):** A session can include an optional host Steam profile link and explicit “join via Steam” instructions.
- **FR-023 (M0):** A member may create an ad-hoc play session with an expiry time, an activity description, available places, host link, and visibility.
- **FR-024 (M0):** Session cards must show freshness, host, activity, and whether places remain. Expired sessions disappear from active listings.
- **FR-025 (M1):** Event calendar supports upcoming, past, and event-type filters.
- **FR-026 (M1):** Hosts can post a brief session debrief and link relevant guides.
- **FR-027 (M2):** Recurring event templates and optional calendar exports.
- **FR-028 (M0):** Members can browse open squads/sessions by activity, start time, role needs, experience expectation, voice coordination, and places available.
- **FR-029 (M0):** Session hosts can specify open, approval-required, or Steam-friends-first participation, with a clear join path and expiry.
- **FR-029a (M0):** A member's “Join squad” action records an in-app join request or intent and then presents the session's validated Steam/game handoff. The site must not claim that a request automatically adds a friend or joins a Wardogs match.
- **FR-029b (M1):** If Wardogs exposes a supported Steam Rich Presence/lobby/server join handoff, the site may offer a direct “Open in Steam/Wardogs” action after a compatibility spike. Provide profile/add-friend and written-instructions fallback.
- **FR-029c (M1):** Members may opt into an expiring “playing now / looking for group” listing; status is member-posted and must not be inferred from Steam presence.
- **FR-060 (M1, feasibility-gated):** The product may offer an opt-in Steam Rich Presence bridge only after a technical and platform-policy spike confirms a supported way to obtain and relay the member's own Wardogs status. Steamworks documents friend Rich Presence and join metadata as game/client-side capabilities; a normal website cannot read them directly. A local companion is a candidate architecture, not an assumed implementation.
- **FR-061 (M1, feasibility-gated):** Members must explicitly enable sharing, choose the fields to share, set visibility, and be able to pause or revoke sharing. Defaults are off and member-only. Any shared state expires quickly and is cleared on disconnect, revoke, or expiry.
- **FR-062 (M1, feasibility-gated):** If verified, presence may help sort squad listings and show simple states such as “Playing Wardogs”, “Looking for players”, or “Joinable”. It must not claim a successful game join until the game confirms it.
- **FR-063 (M1):** Never use game activity or presence for public ranking, reputation, discipline, advertising, or eligibility decisions. Do not collect detailed in-game values such as profit/loss unless a distinct user need, consent, visibility, and retention policy are approved.

### Knowledge and video library

- **FR-030 (M0):** Members can browse and search published resources by title, description, contributor, and approved tags.
- **FR-031 (M0):** Resources may be YouTube videos or written guides; the initial implementation may launch video-first if delivery scope requires it.
- **FR-032 (M0):** Submission accepts valid YouTube video URLs, extracts a video ID, and provides a preview before publication.
- **FR-033 (M0):** Contributor can supply/correct title, summary, tag selection, relevant game version, and optional map/mode/faction context.
- **FR-034 (M0):** Only configured trusted-contributor roles can publish directly. Other member submissions may enter pending review if that feature is enabled.
- **FR-035 (M0):** Published resources support reporting, moderator hide/restore/remove, tag correction, and an audit record.
- **FR-036 (M0):** Resource status includes current, needs review, outdated, hidden, and removed; exact visible states are governed by role.
- **FR-037 (M0):** Embed uses a privacy-conscious YouTube embed configuration, no autoplay, and a clear external YouTube link.
- **FR-038 (M1):** Members can bookmark resources and mark them helpful; popularity signals must not replace search and curation.
- **FR-039 (M1):** Moderators can merge or deprecate duplicate tags while preserving old resource associations.

### Game wiki integration

- **FR-044 (M0):** The main site provides a clearly labeled **Game Wiki** navigation entry to the existing Wardogs Game Knowledge Base.
- **FR-045 (M0):** The wiki remains sourced from its Git repository and generated MkDocs output. The website must not treat generated HTML or a manually copied database as the authoritative article source.
- **FR-046 (M0):** Wiki pages retain source citations, game-version applicability, document version, status, confidence, review date, and related-document links wherever these are present in source metadata.
- **FR-047 (M0):** The wiki landing page exposes the existing category/foundation/depth/reference structure and the MkDocs search experience.
- **FR-048 (M0):** Each wiki page visibly identifies the material as an unofficial fan reference and directs readers to verify patch-sensitive facts against the current game version.
- **FR-049 (M0):** Community guides and member-submitted videos remain separate content types. They must not inherit the wiki's evidence/confidence claims unless reviewed and incorporated through the KB repository workflow.
- **FR-049a (M1):** Provide contextual links between relevant wiki articles and community videos/guides without merging their authorship, lifecycle, or review authority.
- **FR-049b (M1):** Search may offer separate Wiki and Community Guides scopes. A unified search is optional and must clearly label result type and trust/status metadata.

### News, highlights, and learning

- **FR-040 (M0):** Admins/editors can publish community news and announcements.
- **FR-041 (M1):** Members can submit highlights or after-action reports with optional media links and structured lessons.
- **FR-042 (M1):** Guides may be grouped into learning paths or drills (e.g., callouts → positioning → coordinated assault).
- **FR-043 (M2):** Versioned training plans, progress tracking, and squad-level learning dashboards.

### Moderation and administration

- **FR-050 (M0):** Permission assignments are configurable and are not hard-coded to display labels.
- **FR-051 (M0):** Authorized members can submit reports against resources, profiles, sessions, or comments if comments are added.
- **FR-052 (M0):** Moderators have a queue with status, reason, report count, content context, and action history.
- **FR-053 (M0):** Moderators can hide content immediately, restore it, edit tags/metadata, remove it, or dismiss a report.
- **FR-054 (M0):** Removal is recoverable for an administrator within a retention window; permanent purge is a separate controlled operation.
- **FR-055 (M0):** Admins can grant/revoke roles, assign expiry where appropriate, and view who changed permissions and why.
- **FR-056 (M0):** A private moderation log records actor, action, target, reason, and timestamp.
- **FR-057 (M1):** Contributor receives a private notice when content is changed, hidden, or removed, with reason and appeal route.
- **FR-058 (M1):** Temporary publishing restrictions can have start/end dates and a reason.

## 8. Trust, reputation, and discipline requirements

- Reputation is an optional recognition signal for constructive contributions. It does not automatically grant moderation authority or override reports.
- Reports are review signals, not proof of wrongdoing. Do not apply automatic punishment from report volume alone.
- Trust levels and permissions should be based on explicit role assignment and reviewable criteria.
- Discipline is private to moderators and affected members except where a public safety notice is necessary.
- Use proportionate steps: guidance, correction, temporary publishing restriction, temporary suspension, removal for serious/repeated abuse.
- Provide a route for appeal or review by a different administrator where practical.

## 9. Success measures

Measure usefulness rather than raw page views alone:

- Visits that lead to Discord or Steam group joins (where measurable without intrusive tracking).
- Number of members who opt into a Steam profile link.
- Session postings, RSVP participation, and attendance feedback.
- Resource submissions, search use, and resource opens from search/filter results.
- Median time from report to moderator disposition.
- Percentage of reported resources restored or corrected versus removed.
- Returning contributors and repeat session hosts.
- Member feedback on finding a group session or guide.

Analytics should be privacy-minimal, disclosed, and configurable. Avoid collecting granular behavioral data without a clear need.

## 10. Quality attributes

- Mobile-first, keyboard-operable, accessible content and controls.
- Fast initial load and usable core pages on modest connections.
- Search and filtering remain understandable on a small screen.
- No dependence on a Wardogs server being online.
- Recoverable content operations and documented backups.
- Privacy by default for identity and presence information.
- Maintainable content model and editable taxonomies.
