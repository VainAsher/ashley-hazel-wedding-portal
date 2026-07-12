# Stag & Hen Party Portals — D1 contract (ROADMAP Wave 3 item 14, phase 1)

Agreed 2026-07-12, refining ROADMAP item 14's three open decisions:

1. **Individual couple identity.** Today there is one shared `couple` invite
   code (prod: `-4RJ6YRQIA`, household_name "Ashley & Hazel"). This ships
   **two** couple invites instead — one each — so the system can tell Ashley
   and Hazel apart. **Operational note:** after this deploys, the couple
   needs to generate and start using two separate codes; the old shared one
   keeps working for whoever holds it until replaced.
2. **Cross-grant access, not blanket exclusion.** Each partner is
   automatically excluded from their own party (to protect the surprise) but
   the *other* partner's default visibility is now a **wedding-level
   setting** the couple can change any time in Settings — not hardcoded:
   - `partner_visible` (default): the non-subject partner sees their
     partner's party from the start (they're not the one being surprised)
     and controls a **reversible toggle** to reveal it to the subject.
   - `locked`: the non-subject partner also starts locked out; a coordinator
     or that party's Best Man/Maid of Honour grants them in first, and only
     then can they toggle the reveal for their partner.
   Either way, the subject is **never** self-service — only their partner,
   a coordinator, or that party's admin can flip their reveal on.
3. **Best Man / Maid of Honour.** Flagging a guest into a party gains a
   single-select "Best Man" (stag) / "Maid of Honour" (hen) designation —
   at most one per party — which grants `party_admin`. Assigning a new one
   automatically clears the previous holder.
4. **Profiles: guest-visible, not party-only.** (Feeds ROADMAP item 15 when
   built — recorded here so the decision isn't lost.) The "Meet the wedding
   party" page is visible to every logged-in guest, not gated to party
   members.

## Data model — migration 021_party_portals.sql

- `invites` gains:
  - `party VARCHAR(10) NULL CHECK (party IN ('stag','hen'))` — guest's party
    membership (already reserved conceptually in ARCHITECTURE.md).
  - `party_admin BOOLEAN NOT NULL DEFAULT FALSE` — Best Man / Maid of Honour.
  - `party_title VARCHAR(50) NULL` — friendly label, auto-set to
    "Best Man"/"Maid of Honour" when `party_admin` is set for stag/hen
    respectively (kept editable in case the couple wants different wording).
  - `partner_label VARCHAR(50) NULL` — meaningful only when `role='couple'`:
    "Ashley" / "Hazel", admin-set per couple invite. Display only; not used
    for access logic (that's `associated_party` below) so a name change
    never breaks anything.
  - `associated_party VARCHAR(10) NULL CHECK (IN ('stag','hen'))` —
    meaningful only when `role='couple'`: which party is *this partner's
    own* do (Ashley → stag, Hazel → hen, or however the couple assigns it —
    don't hardcode names to values).
  - Partial unique index `uq_one_party_admin_per_party` on
    `(wedding_id, party) WHERE party_admin = true` — DB-level backstop; the
    admin-flagging endpoint still proactively clears the previous holder
    first so this should never actually fire in normal use.
- `weddings.party_visibility_mode VARCHAR(20) NOT NULL DEFAULT
  'partner_visible' CHECK (IN ('partner_visible','locked'))` — the new
  Settings dial (own card, alongside Menu/Theme).
- `party_reveals` (new table): `id, wedding_id FK CASCADE, party VARCHAR(10)
  CHECK(stag/hen), invite_id FK invites CASCADE, revealed BOOLEAN NOT NULL
  DEFAULT FALSE, updated_at`. UNIQUE `(wedding_id, party, invite_id)`. One
  row per couple-invite-that-needs-gating; absence of a row falls back to
  the mode default (non-subject only — subjects with no row are always
  locked out, regardless of mode).
- `party_messages` (new table, blessings-pattern): `id, wedding_id FK
  CASCADE, party VARCHAR(10) CHECK(stag/hen), invite_id FK invites CASCADE
  (author), message TEXT NOT NULL, hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at`. Party-admin can pin/hide (hide reuses the blessings
  moderation pattern; add `pinned BOOLEAN NOT NULL DEFAULT FALSE` too).
- `party_info` (new table): `wedding_id FK CASCADE, party VARCHAR(10)
  CHECK(stag/hen), details TEXT NULL, updated_at`. PK `(wedding_id, party)`.
  Free-text date/venue/plan blurb, editable by that party's admin.

## Access rule (the security-critical part — test this exhaustively)

For a **guest**-role invite: allowed iff `invite.party == party`. Full stop.

For a **couple**-role invite requesting `party` P:
```
is_subject = invite.associated_party == P
row = party_reveals row for (wedding, P, invite.id), if any

if is_subject:
    allowed = row.revealed if row exists else False
else:  # P is their partner's party, not their own
    if row exists:
        allowed = row.revealed
    else:
        allowed = wedding.party_visibility_mode == 'partner_visible'
```
**Coordinators do NOT get automatic access to party content** (message
board, details, membership) — this is deliberately the one guest-facing
surface coordinators can't see by default, to keep the "private space for
the party" promise intact. Coordinators keep full admin control of the
*mechanics* (flagging membership, Best Man/MoH, the visibility-mode dial,
and — as a fallback — the reveal toggles themselves) via the existing admin
pages, just not read access to the party's own social content. **Flag this
one for the couple to confirm** — it's the biggest judgment call in this
spec and the easiest to reverse if wrong.

Routes are explicit per party — `/party/stag` and `/party/hen` — rather
than the single `/party` originally sketched in ROADMAP.md, since a couple
member's access to the two parties is no longer symmetric. `GET
/api/party/access` returns `{stag: bool, hen: bool}` for nav-rendering only;
every actual content endpoint independently re-checks the rule above
(never trust nav-hiding as the security boundary).

## API

- `app/api/party.py` (new router):
  - `GET /api/party/access` — the nav-hint booleans above, for any
    authenticated guest-level member.
  - `GET /api/party/{party}/summary` — details + membership list + message
    board, gated by the rule above; 403 (not 404 — the party categorically
    exists, just not for you) when denied.
  - `POST /api/party/{party}/messages`, `PATCH .../messages/{id}` (pin/hide,
    party-admin only), gated the same way.
  - `PUT /api/party/{party}/info` — party-admin only.
  - `PATCH /api/party/{party}/reveal` body `{invite_id, revealed}` —
    upserts a `party_reveals` row. Authorization:
    - coordinator: always.
    - that party's admin (Best Man/MoH): always, for either couple member's
      row in their party.
    - the non-subject partner, but **only** for the subject's own row (i.e.
      Hazel can toggle Ashley's stag-reveal once Hazel herself has access;
      Hazel cannot touch her own stag-access row in `locked` mode — that
      needs a coordinator or the Best Man).
    - the subject themself: never (can't self-reveal).
- `app/api/guests.py` / invites admin: extend the existing invite
  create/update endpoints with `party`, `party_admin` (server clears any
  prior holder for that party first, inside the same transaction), and for
  couple invites, `partner_label` + `associated_party`.
- `app/api/settings.py`: extend wedding settings PATCH with
  `party_visibility_mode`.

## Frontend

- Admin **Invitations**: when generating/editing a `couple` invite, two new
  fields (partner label, associated party). When generating/editing a
  `guest` invite, a "Wedding party" section: Stag/Hen/none radio, and — only
  when a party is chosen — a "Best Man"/"Maid of Honour" checkbox (reads as
  radio-like exclusivity messaging: "assigning this clears it from whoever
  currently holds it").
- Admin **Settings**: new small card, "Party visibility" — the two-option
  dial with the same plain-language framing as the two questions above.
- **Guest nav**: "Stag Do" / "Hen Do" entries appear per `GET
  /api/party/access`, hidden entirely when access is false (not shown-disabled
  — no need to advertise the existence of a locked door).
- **Party page** (`/party/stag`, `/party/hen`): details card (party-admin
  gets an edit affordance), members list, message board (blessings-style:
  compose box, list, party-admin pin/hide). When the viewer is the
  *non-subject* couple member and `mode == partner_visible` or they hold an
  explicit grant, show a small persistent banner: "{Subject name} hasn't
  seen this yet — reveal it to them?" with the reversible toggle.
- Reuse the blessings/gallery moderation visual patterns — nothing novel
  needed here.

## Tests (security-critical — exhaustive on the access rule)

Backend: every branch of the access-rule truth table (subject with/without
row, non-subject with/without row × both modes), guest-role party==null
denied, guest of the *other* party denied, coordinator denied party content
but allowed the admin mutations, reveal-toggle authorization matrix (each
of the four actor types × allowed/denied), Best Man/MoH single-holder
enforcement (assigning a new one clears the old — assert via the DB, not
just the response), cross-wedding 404s throughout. Playwright: nav entries
appear/disappear per access, the reveal banner + toggle, party-admin
message pin/hide, the admin invite-editing flows for both new field groups.

## Deliberately out of scope for D1

D2 (mount `TaskBoard` with `context='stag'|'hen'` — trivial now, it already
accepts a context prop) and D3 (wedding-party mini profiles, ROADMAP item
15) are separate follow-on items, sequenced as originally planned. Not
touching `tasks.assigned_to` (logged separately in FEEDBACK_BACKLOG.md).
