# Couple Guide — Ashley & Hazel

This is **your** portal. You have **full access** — everything a coordinator can do
(see `COORDINATOR_GUIDE.md` for the module-by-module detail), **plus** the things
reserved for you: **issuing invite codes**, flagging the **wedding party**, the
**Stag/Hen** surprise mechanics, and owning the **go-live** switch.

Site: **https://ashley-and.hazel-of-halifax.com** · Each of you logs in with your **own
individual couple code** (kept in your password manager) — Ashley has one, Hazel has
another, so the portal can tell you apart for the Stag/Hen access rules below.

## Everything the coordinator can do
Guests, RSVP overview, Budget, Vendors, Events, Timeline (drag-and-drop task board),
Communications (now with real in-app delivery), Gallery moderation, **Music
(Dancefloor curation + reactions + now-playing + DJ export)**, Blessings moderation,
Feedback triage, and Settings (**Guest Site Theme + fonts**, **Menu builder**, **Party
visibility**) — all covered in the Coordinator guide. Below is what's **extra/yours**.

## Invitations — *issuing & editing codes (couple-only)*
This is how people get in. In **Admin → Invitations** you can **generate invite codes**
and choose each code's **role**:
- **guest** — can RSVP, see the schedule, post blessings, use the gallery. Can also be
  flagged into the **Stag or Hen party** (see below).
- **coordinator** — full planning admin **except** this Invitations page and Stag/Hen
  content itself.
- **couple** — full access. Issue **one each** to yourselves (not a single shared
  code) — this is what lets the Stag/Hen rules below tell you apart. Each couple code
  gets a **label** (e.g. "Ashley"/"Hazel") and an **associated party**: whichever of
  you the Stag do is *for* gets `associated_party = stag`, and likewise `hen` for the
  other — that's what the surprise-protection logic keys off.

You can link a code to a specific guest record (so their RSVP attaches to them) or to a
household. Hand codes out however you like (message, card insert, etc.).

## Wedding party — Stag & Hen portals
Flag any guest invite with **party: Stag or Hen** in Invitations, and they'll get a
private "Stag Do"/"Hen Do" area to plan in — a details card, member list, and a message
board, invisible to the other party and (by default) to the two of you. One member per
party can be marked **Best Man** (Stag) or **Maid of Honour** (Hen) — ticking this for
someone automatically un-titles whoever held it before. That person can pin/hide
messages and edit the party's details card.

**The surprise mechanic:** each of you is excluded from your *own* party by default —
that's the whole point. Whether your partner sees *your* party by default is a
**Settings → Party visibility** dial:
- **Partner sees by default** (the starting setting) — e.g. Hazel can see Ashley's Stag
  planning from day one (it's not her surprise), and gets a **reveal toggle** on that
  party's page to let Ashley in whenever she thinks the time's right.
- **Locked** — even the non-subject partner starts locked out; the Best Man/Maid of
  Honour (or a coordinator, as a fallback) grants them in first, and only then can
  *they* reveal it onward to their partner.
Either way, the reveal is a **reversible toggle**, and the subject of a party can never
unlock it for themselves — only their partner, that party's admin, or a coordinator can.

## The go-live flow — planning → inviting → RSVP open
You're currently **`live`** — guests can log in, RSVP, and request songs. The full
lifecycle, in case you ever step back or forward:

1. **Plan privately.** Add your guest list, build the schedule (Events), set the budget,
   fill venues in **Settings** — all while in `planning`, so no guest can RSVP yet.
2. **Issue invite codes** in **Invitations** for the people you're inviting.
3. **Open responses:** in **Settings**, change **phase → `live`**. Now guests can
   RSVP and request songs on the Dancefloor.
4. **Closer to the day:** switch **phase → `event`** to freeze responses (day-of mode).
5. **After:** **phase → `archived`** makes everything read-only.

> The phase is the single switch between "just us planning" and "guests can RSVP." You
> can flip back to `planning` any time before you've invited people.

## Your data
The portal holds **real guest details** (names, contacts, RSVPs, dietary needs) and your
photos. It's private — only you and your coordinators can see guest data; guests only see
the schedule, approved photos, and each other's blessings. Keep **each of your individual
couple codes** safe (they're the key to everything — including, now, to each other's
surprises).

## Things to know (current limitations)
- **Communications deliver in-app now**, not yet to real email/WhatsApp/SMS — a guest
  sees it via their bell + dashboard, but if you need it in their actual inbox, send
  that separately through your usual channel too, for now.
- **Gallery is photos only** (no video).
- **Backups:** a nightly database backup runs automatically on the host, plus full-VM
  snapshots — see the IT Admin guide if you ever need a restore.

## When something's wrong or you have an idea
Jot it in **`docs/FEEDBACK_BACKLOG.md`** (or just tell whoever maintains the site). It's
the running list that feeds the **next update** (~4 weeks after launch).

## Need the technical/ops side?
For deploys, backups, the domain/hosting, and troubleshooting, see
**`IT_ADMIN_GUIDE.md`** and **`docs/ci/PRODUCTION_RUNBOOK.md`**.
