# Coordinator Guide — Ashley & Hazel Wedding Portal

For someone **helping coordinate** the wedding. You have an admin login with access to
almost all planning tools. What's reserved for the couple is **invite-code management**
(Invitations) — including who's flagged into the wedding party — and reading the
**Stag/Hen party content** itself.

Site: **https://ashley-and.hazel-of-halifax.com**

## Getting in
1. The couple give you a **coordinator invite code**.
2. Enter it on the invite screen → you land on the **Admin dashboard** (`/admin`).
3. On a phone, tap the **☰ Menu** button to open the sidebar.

## The admin dashboard
A summary across the top — **RSVP count** (accepted / total), **budget** (spent /
planned, in £), and **event count** — with quick links into each module. The left
sidebar lists all modules. A **bell icon** in the top header shows a badge when you
have unread notifications (e.g. from a Feedback submission or a comms send).

## What you can do

### Guests
The full guest list. **Add, edit, delete** guests and record: name, email, phone,
relationship, RSVP status, meal choice, dietary notes/restrictions, plus-one details,
table & seat numbers, and free-text notes. **Export** any row to CSV, or **Export all
guests** at once, for spreadsheets/caterers/etc.

### RSVP (overview)
A read-only summary of responses — totals for **accepted / declined / pending /
tentative**, a **meal-choice breakdown** (for catering numbers, updates live from
whatever menu options are in play — see Menu below), and a filter by status.
> Note: guests submit **dietary requirements only** until the couple finalise the menu
> and flip **"Meal selection open"** in Settings — then a meal picker appears on their
> RSVP page and the breakdown here fills in accordingly.

### Budget
Line items with **estimated vs actual cost**, **paid** status, payment date, category,
and linked vendor. A summary shows total planned/actual/paid and remaining — all in
**GBP (£)**. Add/edit/delete items; categories are a shared list.

### Vendors
Your vendor directory — name, category, contact person, email, phone, website, and
whether the **contract is signed**. Linked to budget categories.

### Events
The wedding **schedule** the guests see — ceremony, reception, rehearsal, etc., each
with date, time, location, description. Add/edit/delete; shown in date order.

### Timeline (task board)
A full **drag-and-drop kanban board** — columns **Not started / In progress / Blocked /
Done**, each colour-coded with a count. Drag a card between columns or within one
(keyboard-friendly: focus a card's handle, press space to lift, arrows to move, space
to drop — the **← →** buttons on each card do the same thing without dragging).
Priority and assignee are **editable right on the card** (no dialog needed); due dates
show as a chip that turns **amber** within a week and **red** once overdue. A **search
box** and **priority filter** narrow the board (dragging is paused while filtering, to
keep things predictable), and a progress bar tracks **"N of M done"**. **+ Add task**
sits at the bottom of each column, pre-set to that status.

### Communications
Draft guest messages — **channel** (Email / WhatsApp / SMS / Announcement),
**audience** (All / Attending / Pending / Declined), and **status** (Draft / Scheduled /
Sent). Pressing **Send** now genuinely **delivers** — every matching guest gets an
in-app notification (the bell icon + a card on their dashboard). Email/WhatsApp/SMS
themselves aren't wired up to an external provider yet, so for those channels, send the
real message through your normal channel too — the in-app copy is a reliable backstop
either way.

### Music (Dancefloor curation)
Guest **song requests** arrive as *Pending* — each shows the song, who asked, their
dedication, any resolved link metadata, and a **♥ reaction count** once approved.
For each request: **Approve** (onto the playlist), **Reject**, or **Block** (adds it to
the **do-not-play list** for the DJ). Duplicate requests are grouped automatically with
a one-click **Merge**. In the **Approved playlist** you can **pin** favourites,
**reorder** the running order, and mark one **"Now playing"** — guests see it
highlighted live on their Dancefloor page, handy on the day itself. **Export**
produces the **DJ pack** — a CSV or printable text file of the playlist plus the
do-not-play list.

### Gallery (moderation)
The photo **moderation queue**. Guest-submitted photos arrive as **Pending**; you
**Approve** or **Reject** them. You can also **upload** photos directly (those are
auto-approved). Filter by All / Pending / Approved / Rejected. Photos only — no video.
The grid loads lightweight thumbnails automatically; the lightbox always shows the
full-resolution original.

### Blessings (moderation)
Guest well-wishes. **Hide/Unhide** any message (hidden ones disappear from the guests'
wall) or **delete** it. Filter by Visible / Hidden.

### Feedback (triage)
Anything a guest flags via the in-site **💬 Feedback** button lands here — Bug or Idea,
their message, and where/who/what device it came from. Move items through **New →
Triaged → Done** as you work through them; this is the self-serve front door to the
project's backlog.

### Settings
Edit the core wedding details — **couple names, date, ceremony time, venues** — and the
**phase** (see below). Changing these updates what guests see on their dashboard/RSVP.

Settings also has:
- **Guest Site Theme** — accent colour, deep colour, photo-tint strength, **heading and
  body fonts** (a curated pick-list of wedding-appropriate faces), and a **type scale**
  (Cosy / Standard / Roomy) — all with a live preview and a reset-to-default.
- **Menu** — build the wedding menu (name, description, dietary chips: veg/vegan/GF),
  then flip **"Meal selection open"** once it's final to unlock meal pickers on guest
  RSVP forms.
- **Party visibility** — controls whether a partner sees their other half's Stag/Hen
  planning by default, or starts locked out too (see the Couple guide for the full
  Stag/Hen picture — flagging party membership itself is couple-only, via Invitations).

Saving any of these applies immediately — no deploy needed.

## The wedding "phase" — what it controls
| Phase | What it means | Guest RSVP & song requests |
|-------|----------------|------------|
| **planning** | Setting up; guests can log in but not respond | **closed** |
| **live** | Open for responses | **open** |
| **event** | Day-of mode; responses frozen | closed |
| **archived** | After the wedding; read-only | closed |

You can change the phase in **Settings**. Most teams stay in **planning** until invites
go out, then switch to **live**.

## What you *can't* do
- **Generate or edit invite codes** (Invitations) — that's **couple-only**, including
  flagging a guest into the Stag or Hen party, naming the Best Man/Maid of Honour, and
  the couple's own individual invite identities. Ask Ashley or Hazel for any of that.
- **See Stag/Hen party content or membership.** The message board, details, and member
  list for each party are visible only to that party's members and the couple (once
  revealed to them) — not to coordinators, by design, to keep it a private space. If
  you need to know who's flagged into which party, ask the couple.

## Tips
- **Catering numbers:** use the RSVP overview's meal breakdown.
- **Mobile:** the sidebar is behind the **☰ Menu** button.
- Anything broken or awkward? Note it in `docs/FEEDBACK_BACKLOG.md` for the next update.
