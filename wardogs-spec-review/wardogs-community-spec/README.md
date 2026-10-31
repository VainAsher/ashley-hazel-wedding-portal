# Wardogs Community Hub — Developer Handoff

**Status:** Product and implementation design draft  
**Prepared:** 31 October 2026  
**Audience:** Product owner, web developer, designer, community moderators  
**Revision:** 1.1 (consolidated and corrected; see *Revision history* at the end)

## Purpose

Design a community website for a growing Wardogs group whose current community channels are Discord and a small Steam group. The Steam group is practically useful because members add one another as Steam friends and use the friend list to find and join each other in game. The community does not currently operate a private game server. The website should improve discovery, coordination, learning, and continuity now, while allowing server-related capabilities to be added if growth supports them later.

The VainCraft website is a structural reference for a branded community hub with areas such as news, events, team, members, and galleries. Wardogs should use the elements that fit its current play pattern rather than importing game-server-specific assumptions.

## Pack contents

1. `01_PRODUCT_REQUIREMENTS.md` — vision, scope, users, requirements, success measures.
2. `02_UX_AND_WORKFLOWS.md` — navigation, page specifications, key journeys, responsive behavior.
3. `03_ROLES_MODERATION_AND_GOVERNANCE.md` — roles, permissions, reporting, discipline, auditability.
4. `04_DATA_MODEL_AND_API.md` — proposed entities, relationships, API behavior, validation.
5. `05_TECHNICAL_ARCHITECTURE_AND_SECURITY.md` — architecture, integrations, privacy, security, operations.
6. `06_DELIVERY_AND_ACCEPTANCE.md` — release sequence, acceptance criteria, delivery checklist.
7. `07_DECISIONS_AND_OPEN_QUESTIONS.md` — assumptions and decisions to make before implementation.
8. `08_GAME_WIKI_INTEGRATION.md` — integration design for the existing Wardogs Game Knowledge Base.
9. `09_SQUAD_FINDER_AND_STEAM_JOIN.md` — squad discovery, 18+ UK community details, feasible Steam join handoffs, and an opt-in Rich Presence feasibility path.

## Product summary

The website is the community’s durable hub. Discord remains the place for live conversation and voice coordination. Steam remains the practical bridge for finding and joining friends in game. The site provides reusable knowledge, planned sessions, opt-in member information, and a record of community activity.

### Initial release

Delivered in phases; the recommended first deployment is the thin **Release 1a** slice in `06` §1.

- Public landing and join information.
- Events and member-posted play sessions.
- Opt-in member profiles with Discord and Steam profile links.
- Searchable guide and YouTube resource library.
- Integrated game wiki using the existing evidence-based, versioned Wardogs Knowledge Base as its canonical factual source.
- Trusted contributors can publish directly; reporting and moderator tools address content that needs correction or removal.
- News/highlights and a small team/moderation page.
- Admin controls for roles, tags, and moderation.

### Later releases

- More structured training plans and after-action reports.
- Community contribution badges or recognition.
- Optional server operations pages if a server is funded, staffed, and approved.
- Further integrations only where they solve a demonstrated community need.

## Wiki integration decision

The existing [WARDOGS Game Knowledge Base](https://github.com/VainAsher/wardogs-game-knowledge-base) should become the site's canonical **Game Wiki**. Keep its version-controlled Markdown, master catalogue, source citations, confidence/status metadata, and generated MkDocs site as the source of truth. The website links to or hosts the generated wiki; it does not copy factual articles into a second editable database.

Keep community-authored tactical advice, drills, after-action reports, and YouTube submissions in a separate **Community Guides** area. Each surface should label whether content is evidence-based game reference or community practice/advice. See `08_GAME_WIKI_INTEGRATION.md` for integration and release details.

Wardogs UK is an 18+ UK-based community aimed at helping members group up in game. The **Play Together** area should grow into a squad finder with member-posted availability and a clear Steam/game handoff. The website can organize discovery immediately; one-click in-game joining depends on supported Steam/Wardogs join functionality and must be verified before being promised. See `09_SQUAD_FINDER_AND_STEAM_JOIN.md`.

## Implementation principle

Keep the product stack-neutral until the existing Wardogs site/repository and hosting constraints are inspected. The developer should map this design onto the existing framework and identity system where practical, documenting any deviations and their effect on requirements.

## Revision history

**1.1 — 31 October 2026 (review corrections)**

- Consolidated into a single document set; the earlier duplicate folder copy is withdrawn.
- Canonical top-level navigation defined (Home · Play Together · Community Guides · Game Wiki · Community · Members · About).
- Data model completed for the squad finder: listing types, squad fields, host-detail disclosure rules, seat counting, notifications, restrictions, and missing API endpoints.
- Resource lifecycle aligned between `03` and `04` (adds review/reject and admin restore).
- Wiki base-path and per-page notice identified as Knowledge Base repository changes with a named owner.
- UK compliance section added (Online Safety Act, UK GDPR, PECR) as items to confirm before launch.
- Steam feasibility spike extended with Steam OpenID, Steam Web API, and candidate join URI forms.
- YouTube click-to-load embed promoted to launch-critical.
- Thin first release (Release 1a), small-team appeal fallback, and a non-binding open-source self-hosted reference deployment added.

**1.0 — 31 October 2026** — Initial draft.
