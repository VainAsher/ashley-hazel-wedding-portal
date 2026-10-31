# Wardogs Community Hub spec — Fix Log and Final Review

**Corrected pack:** `wardogs-community-spec/` (Revision 1.1) · **Baseline:** `original/` · **Plan:** `FIX_PLAN.md` · **Full diff:** `changes.diff`

## 1. Fix status

| ID | Fix | Status | Where |
|---|---|---|---|
| A1 | Single document set; revision history | Done | README |
| A2 | Duplicate README paragraph removed | Done | README |
| A3 | VainCraft / VainsWorld naming | Raised as decision (intent can't be determined from the pack) | 07 Q29 |
| A4 | Canonical navigation (adds Game Wiki, "Learn" → Community Guides) | Done | 01 §6, 02 §2 |
| A5 | FR ID numbering note | Done | 01 §7 |
| B1 | Session model completed: `listing_type`, mode, roles wanted, experience, voice, duration, timezone, new-friends flag, join instructions, training fields, expiry defaults | Done | 04, 09 §4, 02 create flow |
| B2 | Host-detail disclosure matrix (incl. unattested users, members-only sessions) | Done | 04, referenced from 01 FR-029, 02, 09 |
| B3 | Seat counting, auto-full/reopen, host close/reopen (`closed_by_host`) | Done | 04, 09 §5, 06 acceptance |
| B4 | Resource lifecycle: `rejected`, review transitions, admin restore from `removed`, purge semantics; 03 and 04 aligned | Done | 03 §5, 04 §6, 01 FR-034 |
| B5 | `Notification` entity, FR-016, UX section | Done | 04, 01, 02 |
| B6 | `UserRestriction` entity and effective-permission rule | Done | 04, 03 §6 |
| B7 | Generic reports endpoint; join-request, session close/reopen/cancel, notifications, restrictions endpoints; report target/reason/status enums | Done | 04 §1, §3 |
| B8 | Open-policy joins auto-accepted so seats/withdraw/notify work uniformly | Done | 04, 09, 02, 01 FR-029a |
| C1 | `/wiki/` base URL must be a KB generator input; owner question | Done | 05 §1A, 08 §6, 06, 07 Q38 |
| C2 | Per-page unofficial notice via KB theme override | Done | 01 FR-048, 08 §5–6 |
| D1 | UK compliance: Online Safety Act, UK GDPR, ICO fee, PECR | Done | 05 §7A, 03 §9, 06, 07 §H |
| D2 | Steam OpenID + Web API route, same-game Rich Presence limit, candidate join URIs | Done | 01 FR-060, 05 §2–3, 07 Q6/Q9/Q15, 09 §2–3, 04 Profile |
| D3 | YouTube click-to-load facade is M0 | Done | 01 FR-037, 05 §5, 06 |
| E1 | Release 1a thin slice; Phase 1/2 lists de-duplicated | Done | 06 §1, README |
| E2 | Small-team appeal fallback and recusal | Done | 03 §6 |
| E3 | Non-binding open-source self-hosted reference (Proxmox VE, Ubuntu LTS, PostgreSQL, Caddy, Authentik/Keycloak, PBS) | Done | 05 Appendix A |

## 2. Further issues found during the final review (and fixed)

These were not in the original review; they surfaced while re-reading the pack end to end.

1. **YouTube uniqueness contradiction:** `04` said `youtube_video_id` is "unique when present" in one place and "unique among non-removed resources" in another. Now one rule: unique among resources not `removed` or `rejected` (partial unique index).
2. **Open-session instructions bypassed seats:** the first draft of the disclosure matrix showed join instructions to every member of an open session, so people could skip **Join squad** and capacity would be wrong. Instructions and handoffs now appear once a request is accepted (immediately for open sessions).
3. **Host "close" was undone automatically:** a manually closed session would reopen when a seat freed up. Added `closed_by_host` and a `reopen` endpoint.
4. **Search exclusions incomplete:** search excluded hidden/removed/pending but not draft or rejected. Fixed.
5. **Status labels vs stored statuses:** `02` used "Scheduled" as a status, which isn't a stored session status. Now defined as a derived display label; "Cancelled" and "Rejected" labels added.
6. **"Ad-hoc" terminology:** `01`, `02` and `07` used "ad-hoc session" with no matching data value. Mapped to `playing_now` / `looking_for_players`; the 12-hour hard maximum is now stated consistently in `02`, `04` and `07` Q10.
7. **Presence wording collision:** "never infer 'playing now' from Steam" (`06`, `09`) appeared to contradict the optional Stage D presence chip. Clarified: listings are never created from Steam data; a presence chip is a separate, opt-in, labeled indicator.
8. **Accepted members could not be removed** and accepted requests had no exit except expiry. Added `accepted → withdrawn | declined | expired` in `04` and `09`.
9. **FR-063 priority:** a "never use presence for ranking/discipline" rule was tagged M1, implying it didn't apply at launch. Re-tagged "M0 policy".
10. **Phase 2 "Add the Game Wiki navigation entry"** duplicated Release 1a's link. Phase 2 now *integrates* the wiki behind the existing entry.
11. **Notifications phasing:** FR-057 (moderation notices) now explicitly uses the FR-016 mechanism, so there is one notification system.
12. **Editor role** said "learning content" (old naming) and had no review permission. Now "Community Guides content" with `resource.review`; `session.join` permission added.

## 3. Verification performed

- Searched for stale terms (`Learn`, `ad_hoc`, `scheduled_event`, `kind` on Session, "if feasible", "records intent", "Rich Presence bridge") and confirmed the remaining uses are intentional.
- Cross-references (`04` §6, `05` §7A, `03` §9, `08` §6, `09` §2/§4, `07` Q6/Q10/Q25/Q30/Q38–Q42) all point to sections that exist.
- `07` questions number 1–42 with no gaps or duplicates; no duplicate headings in any document; FR IDs unique.
- Every reportable target in `03` §3 has an API route (`POST /api/reports`), and every state change in `04` §6 has an endpoint or background job.

## 4. Remaining items for the owner (not errors — decisions)

- **07 Q29:** confirm how VainCraft and VainsWorld relate.
- **07 Q27 / `05` §1:** the pack still assumes there *may* be an existing Wardogs site to reuse. If there isn't, Phase 0 discovery shrinks to the KB repo and the stack choice (Appendix A is a starting point).
- **07 Q40:** the children's access assessment outcome under self-attestation is a real policy choice; the pack sets a default but the owner should decide.
- **07 Q41:** retention periods are proposed for discussion only.
- **Legal and Steam claims to recheck before relying on them:** the Ofcom/ICO points and the Steam behavior (Rich Presence shared only within the same game; `GetPlayerSummaries` fields; `steam://` join forms) are written as items to verify. They reflect my understanding of current guidance and documentation, not tested results or legal advice.
