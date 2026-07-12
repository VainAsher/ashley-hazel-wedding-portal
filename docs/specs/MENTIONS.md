# @mentions (ROADMAP Wave 3 item 16)

Agreed 2026-07-12. The last Wave 3 item. Parse `@Display Name` in blessings,
song dedications, and party messages; on submit, notify whoever was
genuinely mentioned. Per the roadmap: **store nothing new beyond
`notifications`** — no mentions table, no stored markup. Mentions are
derived fresh from plain text against a live, scoped directory, both when
a message is saved (to fire notifications) and when it's rendered (to
highlight the match) — never trust a client-supplied list of who was
mentioned.

## The scoping rule (the privacy-relevant part)

Guests must never be able to discover the full guest list through
autocomplete. Two scopes:

- **Party scope** (composing a Stag/Hen party message): mentionable =
  members of *that* party only (`Invite.party == 'stag'` or `'hen'`,
  matching `has_party_access`'s own population — reuse its query shape,
  don't re-derive it differently).
- **General scope** (composing a blessing or a song dedication): mentionable
  = wedding-party members (`Invite.party IS NOT NULL`, exactly
  `profiles.py`'s `list_profiles` filter) **plus** the couple
  (`Invite.role == 'couple'`). NOT the full guest list — a guest posting a
  blessing can only @ publicly-known figures (wedding party + couple), never
  another anonymous guest.

Display names: reuse `app/api/profiles.py`'s `_fallback_display_name` +
profile-display-name-override pattern for wedding-party entries (import and
reuse the function, don't reimplement it). For couple invites (which have no
guest/profile), prefer `invite.partner_label` when set; skip a couple invite
from the mentionable list entirely if it has no `partner_label` (an
un-labelled "Couple Invite" is not a nameable person).

## API

- `GET /api/mentions/directory?scope=general|stag|hen` (require_guest) —
  `[{invite_id, display_name}]` for the composer's autocomplete, per the
  scoping rule above. `scope=stag`/`hen` additionally requires the caller
  actually be a member of that party (same access check party.py already
  applies elsewhere) — 403 otherwise; don't let someone probe a party's
  roster by guessing the scope query param.
- A shared `app/utils/mentions.py`: `extract_mentioned_invite_ids(text: str,
  directory: list[tuple[int, str]]) -> set[int]` — for each `@` in `text`,
  greedily match the **longest** directory display name that starts
  immediately after it (case-insensitive), so "Alex Smith" matches before a
  shorter "Alex" would if both exist. Pure function, unit-testable in
  isolation without any DB.
- Wire into the three existing create endpoints (NOT new endpoints — extend
  what's there): `POST /api/blessings`, `POST /api/music/requests` (the
  `dedication` field only — title/artist are never scanned), `POST
  /api/party/{party}/messages`. After the row is created, look up that
  context's scoped directory server-side, run `extract_mentioned_invite_ids`
  against the submitted text, and for each match (excluding the author
  mentioning themself, which is a no-op) create a `notifications` row:
  `kind='mention'`, `title` like `"{author display name} mentioned you in a
  blessing"` (word varies: "blessing" / "song dedication" / "a {Stag Do|Hen
  Do} message"), `body` a short excerpt of the text, `link_path` to
  `/blessings`, `/music`, or `/party/{party}` respectively. Reuse whatever
  notification-creation helper Wave 2's Communications fan-out already has
  (`app/api/communications.py` / `app/api/notifications.py`) rather than
  inserting `Notification` rows ad hoc in three places.

## Frontend

- A small shared `MentionTextarea` (or a thin wrapper around the existing
  plain `<textarea>`s in Blessings.tsx / Music.tsx's dedication field /
  Party.tsx's message composer): on typing `@` followed by characters, fetch
  `GET /api/mentions/directory?scope=...` (debounced, or fetched once per
  mount and filtered client-side — the directories are small, so once-per-
  mount is simpler and fine), show a dropdown of matching names, clicking
  inserts `@Display Name ` (space-terminated) at the cursor.
- **Rendering**: wherever blessing messages, song dedications, and party
  messages are displayed (the blessings wall, the song wall, the party
  message board), run the same `extract_mentioned_invite_ids`-style matching
  client-side against that view's scoped directory and wrap matched spans in
  a subtle highlight (bold + gold-tinted text is enough — no link target
  needed, no new page). This must reuse one shared parsing function between
  blessings/music/party views, not three copies.

## Tests

Backend: `extract_mentioned_invite_ids` unit tests (no match, one match,
multiple matches, overlapping-prefix names picking the longest, mention of
self is excluded from notification fan-out, case-insensitivity). Scoping:
party-scope directory only returns that party's members and 403s a non-
member; general-scope directory includes wedding-party + labelled couple
invites and excludes plain guests and un-labelled couple invites.
Notification fan-out: posting a blessing/dedication/party-message that
mentions an eligible name creates exactly one notification for that
invite, with a sensible title/link_path; mentioning a non-existent or
out-of-scope name creates nothing; self-mention creates nothing.
Playwright: autocomplete shows filtered suggestions and inserts on click
(one test per composer is enough — the mechanism is identical); rendered
highlight appears on the wall/board views.

## Explicitly out of scope

No mentions table, no "who mentioned me" inbox beyond the existing
notifications bell/dashboard card, no cross-context mentions (you can't @ a
Stag member from a general blessing unless they're also flagged
wedding-party — which they already are, by definition, if they're in a
party).
