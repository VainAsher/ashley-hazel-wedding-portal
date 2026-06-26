# Couple Guide — Ashley & Hazel

This is **your** portal. You have **full access** — everything a coordinator can do
(see `COORDINATOR_GUIDE.md` for the module-by-module detail), **plus** the two things
reserved for you: **issuing invite codes** and owning the **go-live** switch.

Site: **https://ashley-and.hazel-of-halifax.com** · You log in with your **couple code**
(kept in your password manager).

## Everything the coordinator can do
Guests, RSVP overview, Budget, Vendors, Events, Timeline, Communications, Gallery
moderation, Blessings moderation, and Settings — all covered in the Coordinator guide.
Below is what's **extra/yours**.

## Invitations — *issuing codes (couple-only)*
This is how people get in. In **Admin → Invitations** you can **generate invite codes**
and choose each code's **role**:
- **guest** — can RSVP, see the schedule, post blessings, use the gallery.
- **coordinator** — full planning admin **except** this Invitations page.
- **couple** — full access (only issue these to the two of you).

You can link a code to a specific guest record (so their RSVP attaches to them) or to a
household. Hand codes out however you like (message, card insert, etc.).

## The go-live flow — planning → inviting → RSVP open
You're currently in **`planning`** (guest RSVP is closed). The natural sequence:

1. **Plan privately.** Add your guest list, build the schedule (Events), set the budget,
   fill venues in **Settings** — all while in `planning`, so no guest can RSVP yet.
2. **Issue invite codes** in **Invitations** for the people you're inviting.
3. **Open RSVP:** in **Settings**, change **phase → `live`**. Now guests can respond.
4. **Closer to the day:** switch **phase → `event`** to freeze responses (day-of mode).
5. **After:** **phase → `archived`** makes everything read-only.

> The phase is the single switch between "just us planning" and "guests can RSVP." You
> can flip back to `planning` any time before you've invited people.

## Your data
The portal holds **real guest details** (names, contacts, RSVPs, dietary needs) and your
photos. It's private — only you and your coordinators can see guest data; guests only see
the schedule, approved photos, and each other's blessings. Keep your **couple code**
safe (it's the key to everything).

## Things to know (current limitations)
- **Communications don't actually send** yet — drafting/tracking only. Send real messages
  through your usual channel for now.
- **Gallery is photos only** (no video).
- **Backups:** your hosting (IT) handles these — see the IT Admin guide. There are
  full-VM snapshots; a database backup script exists to be scheduled.

## When something's wrong or you have an idea
Jot it in **`docs/FEEDBACK_BACKLOG.md`** (or just tell whoever maintains the site). It's
the running list that feeds the **next update** (~4 weeks after launch).

## Need the technical/ops side?
For deploys, backups, the domain/hosting, and troubleshooting, see
**`IT_ADMIN_GUIDE.md`** and **`docs/ci/PRODUCTION_RUNBOOK.md`**.
