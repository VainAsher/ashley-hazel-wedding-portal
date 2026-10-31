# 02 — UX and Workflows

## 1. UX principles

1. Make the next useful action obvious: join, find a session, or find a guide.
2. Treat the website as the durable companion to Discord and Steam, not a duplicate chat service.
3. Keep Steam account/profile visibility opt-in and explain what a link enables.
4. Make contributor actions simple and moderation outcomes understandable.
5. Avoid empty dashboards and speculative server status panels.
6. Design for phone use first; many members will open links from Discord on mobile.

## 2. Navigation and page definitions

Primary navigation follows `01` §6: **Home · Play Together · Community Guides · Game Wiki · Community · Members · About**. Every page shows a persistent Game Wiki link.

### Home

**Purpose:** Explain the community and route visitors to the next action.

**Recommended content order:**

1. Short Wardogs UK community statement (18+, UK-focused) and “Join Discord” call to action.
2. “Find us on Steam” link with a one-sentence explanation that Steam friends help members join one another in game.
3. Open squads/sessions with a create/browse action and a clear UK time label.
4. Featured Community Guides and a Game Wiki entry point.
5. Recent news/highlights.
6. Community principles and report/help route.

Do not imply an official/private server exists unless one has been approved and is operational.

### Play Together

Tabs or filters: **Find a squad**, **Open sessions**, **Scheduled events**, **Past events**.

The squad finder answers: “Who is playing, what are they doing, can I join, and what do I click next?” It is a listing of member-published intent, not a Steam presence mirror.

Session card fields:

- Activity or game mode
- Session title and short description
- Host display name and optional Steam profile link (shown according to the disclosure matrix in `04`: hidden from visitors, and hidden for approval-required sessions until the request is accepted)
- Start time in visitor-local time, with timezone available on detail view
- “Posted X minutes ago” freshness label
- Places open / capacity if supplied (accepted join requests count as taken places; show **Full** when none remain)
- Voice/comms location (usually Discord channel or event instructions)
- Join path: open Steam profile, add friend, or use the host’s stated join instructions
- Join policy: open, host approval required, or Steam-friends-first
- Member-posted activity label: scheduled, looking for players, or playing now
- Report action

The website cannot guarantee the host is currently online or that Steam will permit joining. Copy should describe this as a member-posted invitation, not a live presence indicator.

### Optional Steam presence sharing (future, feasibility-gated)

Keep the squad finder useful without an integration: member-posted sessions remain the source of truth in the first release. If a later technical spike verifies a safe, supported way to obtain a member's own Wardogs status (for example, Steam sign-in plus a consented Steam Web API lookup, or a developer-supported Rich Presence route; see `09` §2), show a separate, clearly labeled status chip such as “Playing Wardogs”, “Looking for players”, or “Joinable”. Never silently turn on sharing or present a stale status as live.

The setup control explains exactly what is shared, who can see it, how long it remains visible, and how to pause or revoke it. Default to off and member-only. Status expires quickly and disappears on disconnect, revoke, or expiry. Detailed game values, if ever considered, require their own explicit field-level choice and must not appear on public profiles by default. A status chip can improve sorting; it does not itself guarantee a direct join.

### Squad finder and join flow

Member chooses **Find a squad**, then filters by activity/mode, time, roles needed, broad experience level, session size, and whether the host accepts new Steam friends. Results show host, squad composition/roles wanted, open places, start/freshness, voice coordination, join policy, and expiry.

On a session detail, the primary action is **Join squad**. For an open listing, this takes a place immediately (if one is free) and reveals the best supported next action; the member can withdraw to free the place. For approval-required sessions, it sends a join request to the host; acceptance reveals the host's Steam link/instructions. For friends-first sessions, offer **Open host on Steam** and explain that Steam friendship or in-game joinability may be required.

If a verified Wardogs join handoff exists, offer **Open Wardogs in Steam**. Treat this as an external application launch: make it an explicit user click, use only a verified Steam URI/URL format, and show the fallback if Steam or the game cannot handle it. Never imply that the website can force the game to join. If the capability is unverified or unavailable, use the host's Steam profile and instructions.

Hosts can close a listing, mark it full, or let it expire. Default “playing now” expiry is four hours; scheduled listings expire after the event. Provide a “leave/cancel my request” action. Do not publish a member's precise online state, roster, or location without their choice.

### Create session flow

Required: listing type (scheduled squad, looking for players, playing now, training event), activity/title, host, start time or “now”, expiry, visibility, join policy. Optional: mode, duration, capacity, experience expectation, roles wanted, voice coordination and Discord location, whether new Steam friends are welcome, Steam link (defaults from the host's profile), join instructions, note; training events add learning goals and preparation notes.

The form states who will see what: making a session public shows its summary to visitors but never the host's Steam link; join instructions are shown only to members whose request is accepted (immediately for open sessions), and choosing **Ask host first** also hides the Steam link until the host accepts.

Validation:

- “Playing now” and “looking for players” listings expire four hours after posting by default (configurable, hard maximum 12 hours; `04`); they cannot persist indefinitely.
- Scheduled event end time must follow start time.
- Steam links must use allowed Steam profile URL forms; reject arbitrary URL schemes.
- Show a preview before publishing.
- Publisher can edit/cancel; moderators can hide or remove.

### Community Guides (resource library)

This area is labeled **Community Guides** in navigation and page headings (earlier drafts called it “Learn”). It contains member-selected videos, squad practice, community-written procedures, and after-action learning. It is distinct from the factual Game Wiki.

Resource listing:

- Search field with clear query reset
- Tag filters grouped by topic/role/format
- Sort: relevant, newest, recently updated
- Resource cards show thumbnail, title, brief summary, tags, contributor, game version/status
- Empty state suggests clearing filters or submitting a resource
- Report action available without opening detail

Resource detail:

- Title and embedded player
- External YouTube link and source attribution
- Summary: what the member will learn and intended audience
- Tags and context (mode/map/faction/game version)
- Contributor and submitted/updated dates
- Outdated/review notice when relevant
- Report action and shareable canonical page URL

### Submit video flow

1. Paste YouTube URL.
2. Validate host and video identifier; reject playlists/channels/shorts only if product decision chooses video-only support. Recommended MVP: accept standard watch and youtu.be video links; explicitly decide Shorts support.
3. Fetch/display metadata preview where possible; if metadata retrieval fails, allow manual title and thumbnail fallback.
4. Enter summary, choose tags, enter optional game context/version.
5. Preview the library card and detail page.
6. Publish immediately for trusted roles; otherwise save as pending if pending review is enabled.
7. Show clear confirmation and the published entry link.

Prevent duplicate video IDs. If a duplicate exists, offer the existing resource and allow the member to suggest a correction or additional context.

### Member profile

Profile fields are opt-in: display name, avatar, short bio, preferred roles, experience band, broad availability/play windows, openness to invites, Discord identity/link, Steam profile link, and contribution list. Age attestation is private account eligibility data, not a public profile field.

Privacy controls should be explicit at field level or at least offer sensible member-only/public settings. Default to minimum disclosure. Do not expose live online status or infer member presence from a Steam profile URL.

### Notifications

Signed-in members see an unread count and a simple notifications list for join-request decisions, session cancellations, moderation actions on their content, restrictions, and role changes. MVP notifications are in-site only; email or Discord delivery is a later opt-in setting. Notifications never reveal who filed a report.

### Events

Event detail includes purpose, format, expected skill/roles, start and end time, host, capacity, RSVP, voice location, Steam join instructions, and accessibility/participation notes. Hosts may optionally post a debrief after the event.

### Community / news

Use a simple editorial feed for announcements, event recaps, member highlights, and important community decisions. Do not create a general discussion/comment system in the MVP; it expands moderation scope and overlaps with Discord.

### About and safety

Show community values, conduct expectations, moderator contacts, report route, and a plain explanation of what happens after a report. Link privacy notice and terms of use where accounts or submissions are supported.

State clearly that Wardogs UK is an 18+ community. Use a self-attestation at registration and a private underage-report route; do not display or request a member's birth date publicly. Unless the owner decides that membership is UK-resident-only, describe the community as UK-based/UK-focused and use Europe/London as the default timezone without geoblocking.

### Game Wiki

The main site's Game Wiki entry opens the existing generated wiki, ideally under a same-site `/wiki/` path while retaining MkDocs navigation, search, citations, document controls, and theme. If same-origin hosting is not practical, use a branded wiki subdomain or the current published wiki URL with reciprocal links to the community hub. Do not rebuild the wiki contents as CMS pages.

Wiki home should preserve the repository's current foundations/depth/reference grouping and coverage overview. Article pages should display source metadata where available: article ID/title, document version, game version, status, confidence, updated/review dates, sources, and related articles. Keep an “Unofficial fan reference — verify against the current game version” notice visible.

From a wiki article, contextual links may open related videos or Community Guides in the community library. From a community guide, a “Game facts” link may point to the relevant wiki page. Label the two destination types clearly. If cross-search is added, provide an explicit Wiki/Community scope filter and distinguish authored advice from source-cited reference.

## 3. Key user journeys

### Visitor becomes a player

Home → read “How to join” → join Discord and/or Steam group → create an account and confirm 18+ → find open session → **Join squad** → view host Steam profile and instructions → join session using Steam → return to site for guides/events.

### Member shares a YouTube resource

Community Guides → submit video → validate/preview → add summary/tags/version → publish as trusted contributor → resource becomes searchable → members report if inaccurate/outdated.

### Reader moves between factual reference and community practice

Game Wiki → search or browse an article (for example, cash rewards, progression, vehicles, FOBs, or maps) → inspect version/confidence/citations → follow a related Community Guide or video for squad application. The reader can tell which material is repository-maintained reference and which is community advice.

### Member finds a group to play with

Play Together → filter open sessions → inspect activity, places, and join policy → **Join squad** (or request a place and wait for acceptance) → open host Steam profile/add friend → coordinate voice in Discord → session expires automatically.

### Moderator reviews a report

Moderation queue → inspect target and report reasons → choose dismiss, request correction, edit, hide, restore, or remove → record reason → notify contributor when appropriate → close report.

### Admin adjusts trust

Admin opens member record → reviews contribution and moderation history → grants/revokes a role with reason and optional expiry → member receives a private notice → audit record is created.

## 4. Visual and interaction direction

- Use Wardogs/community branding and imagery with legible text contrast.
- Establish clear status labels: Open, Scheduled, Full, Expired, Cancelled, Pending, Rejected, Published, Needs review, Outdated, Hidden. Session labels are derived for display: “Scheduled” is an open scheduled squad or training event whose start time is in the future; stored session statuses are those in `04`.
- Avoid color-only meaning; pair color with text/icon.
- Use cards sparingly and ensure keyboard focus is visible.
- Provide loading, empty, error, and success states for all interactive views.
- Confirm destructive-looking actions; prefer “Hide” or “Remove from library” language and explain recovery to moderators.

## 5. Content freshness

Each guide/video should carry an optional game version or update date, an editorial review date, and freshness state. Moderators may mark content outdated without deleting it. Provide a way for members to flag patch-sensitive content.
