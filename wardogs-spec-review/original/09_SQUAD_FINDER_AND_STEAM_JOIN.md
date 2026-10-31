# 09 — Squad Finder and Steam Join Handoff

## 1. Purpose

Reduce the friction between wanting to play Wardogs and joining a suitable group. The community site should help members discover squads, see how to join, request a place, and hand off to Steam/Wardogs through a supported route.

The community is **Wardogs UK**: UK-based, UK-focused, and for adults aged 18+. Its purpose is to help and encourage people to group up in game. The site should make that purpose visible in its landing page, join flow, session tools, and moderation policy.

## 2. What the app can and cannot do

Steam's official Steamworks documentation describes friend-join and lobby-join callbacks that the game client handles. Steam's matchmaking docs describe invitations to game lobbies and the game-side callback/launch behavior. Relevant references:

- [ISteamFriends interface](https://partner.steamgames.com/doc/api/ISteamFriends)
- [Steam Matchmaking & Lobbies](https://partner.steamgames.com/doc/features/multiplayer/matchmaking)
- [ISteamMatchmaking interface](https://partner.steamgames.com/doc/api/ISteamMatchmaking)

The website can organize people and initiate a tested external Steam action, but it cannot add members to the Wardogs friend list, discover who is online, create Wardogs lobbies, or force a client to join unless the Wardogs/Steam integration supports that operation. The game's current Steam friend-join behavior must be tested before the site promises a direct join button.

### Capability matrix

| Capability | Website can provide now? | Dependency / boundary |
|---|---:|---|
| Browse member-posted squads and open sessions | Yes | Site feature; show freshness and expiry |
| Filter by activity, time, roles needed, experience band, and places | Yes | Member-provided metadata |
| Request a place / host accepts or declines | Yes | Site records intent; does not join the game |
| Open the host's Steam profile | Yes | Member supplies a validated profile URL |
| Add the host as a Steam friend | User action | The site can open the profile; it should not send friend requests |
| Launch Wardogs from the site | Potentially | Confirm official Steam launch URL/App ID and browser behavior |
| Join the host's current Wardogs match from the site | Conditional | Requires a reliable game-supported friend, Rich Presence, lobby, or server join handoff |
| Read Steam friend list or live presence | No for MVP | Do not scrape; any later integration needs platform review, consent, and a clear need |

Steam Rich Presence is a useful future lead, not a website API. Steamworks documents friend Rich Presence lookup and join metadata within the Steam client/game-side interface. The Wardogs game must publish useful supported values, and any separate companion or relay path must be validated before the site can use it. A web page alone cannot read the member's local Steam Rich Presence.

## 3. Recommended delivery stages

### Stage A — Squad finder MVP

Build a web-based **Find a squad** page with member-posted sessions and profiles. Members can create a session, select a join policy, accept requests, and add an optional Steam profile link. A member who is not already friends with the host uses **Open host on Steam** and follows the stated steps. A friends-first host can choose that policy and the listing explains that Steam friendship/joinability may be required.

Include **Join squad** as an in-app action. It creates a join request or records the member's intent. Once the host accepts (or immediately for an open session), show the best verified Steam/Wardogs handoff and a written fallback. Do not label the request as a successful game join.

### Stage B — Compatibility spike

Before implementing a one-click in-game join, test with current Wardogs builds and actual community session workflows:

1. Host and joining player are already Steam friends; neither is in a match.
2. Host is in Wardogs and joinable; joining player has the game closed.
3. Both have Wardogs open; joiner is not yet a Steam friend.
4. Host is not joinable, leaves the match, or the match becomes full during handoff.
5. Test links from desktop browser and Steam overlay/client where relevant.

Record the exact supported URI, lobby/server identifier needs, launch behavior, error/fallback states, and any game restrictions. If the game exposes no suitable route, keep the profile-based flow and consider asking the game developer about future Rich Presence/lobby support. Do not create a brittle client-side workaround.

### Stage C — Direct handoff, if verified

Add a contextual **Open Wardogs and join** action only when the session has a valid, current join target and the tested flow works. Use an explicit user click, use only a verified Steam URI/URL format, and show a fallback if Steam or the game cannot handle it. If Steam is not installed/open, the session expired, the target is invalid, or the join fails, return the user to the host profile/instructions page.

### Stage D — Optional Rich Presence bridge, if feasible

Run a separate spike before building this stage. Verify the current game's published Rich Presence values, permitted access route, companion feasibility, policy constraints, and whether the join value is actionable for a community session. Do not assume field names or availability from third-party trackers; game updates may change them.

If supported, let each member explicitly turn on sharing and select approved fields. The initial UI should expose only simple states such as **Playing Wardogs**, **Looking for players**, and **Joinable**. Default visibility is member-only. Status must be short-lived, expire when the client stops reporting, and clear immediately when sharing is paused or revoked. Never retain a history or use status for public reputation, ranking, discipline, or advertising. A join action remains a handoff; display success only if the game confirms it. Detailed values such as profit/loss are out of scope unless members separately opt in after a clear privacy review.

## 4. Squad/session listing model

Listing types:

- **Scheduled squad:** Planned start time, expected duration, host, activity, roles needed, capacity, and voice plan.
- **Looking for players:** Near-term session with current vacancies and a short expiry.
- **Playing now:** Opt-in host/member post; short expiry and explicit “posted by member” label.
- **Training/event:** Structured session with learning goals and preparation notes.

Host-selected join policies:

- **Open to community:** Members may join or request a place, subject to stated capacity.
- **Ask host first:** Join request requires approval before host details or join instructions are shown.
- **Steam friends first:** Host expects a Steam friendship before joining; site explains how to add them.

Fields: title/activity, mode, start time, duration (optional), timezone, host, squad size/capacity, roles wanted, experience expectation, voice coordination, join policy, Steam profile link (optional), description, visibility, status, created/updated time, expiry.

Default timezone is `Europe/London`; render a visitor's local time when possible and always show a timezone label in details. Avoid collection or display of exact geographic location.

## 5. Join request lifecycle

`requested → accepted | declined | withdrawn | expired`

- Open session: member selects **Join squad**; the site records intent and displays join instructions/Steam handoff.
- Approval-required session: host accepts or declines; accepted request reveals the configured Steam link and next steps.
- Friends-first session: site explains the Steam friend requirement and opens host profile; no friend request is sent automatically.
- Host can close the session, mark it full, or cancel it. Requests expire with the session.
- Notify both parties in the site and optionally link to Discord for voice coordination.
- Rate-limit join requests and let members withdraw them.

## 6. UK 18+ membership and privacy

- Display “18+ community” in community-facing copy and member registration.
- Require a private self-attestation before account participation, profile listing, join requests, RSVP, or submissions.
- Do not collect full date of birth or identity documents for MVP. Store the attestation time and policy version only.
- A suspected underage report goes to moderators privately; establish a review, restriction, and appeal process. Do not expose the report or age claim on a public profile.
- The site is UK-based and UK-focused. Whether users must live in the UK remains a policy decision; do not geoblock by default.
- Default event timezone to `Europe/London`; use UK English in interface text.
- Keep member presence and play availability voluntary and short-lived. Do not infer “playing now” from Steam.

## 7. Acceptance criteria

- A member can find sessions by activity/time and see the join policy before requesting to join.
- Session cards clearly show host, open places, freshness/expiry, UK time, and next step.
- Host can accept/decline/close a listing; requester can withdraw; stale listings and requests expire.
- Steam host links are validated and open safely; no arbitrary scheme or redirect is accepted.
- Direct game join is unavailable by default until the compatibility spike documents a working Wardogs/Steam mechanism.
- Steam presence sharing is disabled unless a separate feasibility/policy spike passes; if enabled, consent, visibility, freshness, expiry, and revocation are testable and visible to the member.
- When direct join is enabled, it is user-initiated and has a tested failure fallback.
- The website never claims it read a Steam friend list, sent a friend request, or joined a match unless the relevant supported action actually confirmed that result.
- Adult attestation is required for member participation, private from other members, and does not require date-of-birth storage.
- Public wiki reading remains separate from 18+ member actions if that is the selected access configuration.
