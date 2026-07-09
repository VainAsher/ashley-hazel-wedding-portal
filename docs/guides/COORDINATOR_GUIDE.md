# Coordinator Guide — Ashley & Hazel Wedding Portal

For someone **helping coordinate** the wedding. You have an admin login with access to
almost all planning tools. The one thing reserved for the couple is **generating invite
codes** (Invitations).

Site: **https://ashley-and.hazel-of-halifax.com**

## Getting in
1. The couple give you a **coordinator invite code**.
2. Enter it on the invite screen → you land on the **Admin dashboard** (`/admin`).
3. On a phone, tap the **☰ Menu** button to open the sidebar.

## The admin dashboard
A summary across the top — **RSVP count** (accepted / total), **budget** (spent /
planned, in £), and **event count** — with quick links into each module. The left
sidebar lists all modules.

## What you can do

### Guests
The full guest list. **Add, edit, delete** guests and record: name, email, phone,
relationship, RSVP status, meal choice, dietary notes/restrictions, plus-one details,
table & seat numbers, and free-text notes.

### RSVP (overview)
A read-only summary of responses — totals for **accepted / declined / pending /
tentative**, a **meal-choice breakdown** (for catering numbers), and a filter by status.
> Note: guests currently submit **dietary requirements only** — meal selection opens
> for guests once the menu is finalised (the meal column/breakdown fills up then;
> admins can still record meals per guest in the Guests module meanwhile).

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
A **kanban board** for planning tasks — columns **Not started / In progress / Blocked /
Done**, with priority (low/medium/high), due date, and who it's assigned to.

### Communications
Draft guest messages — **channel** (Email / WhatsApp / SMS / Announcement),
**audience** (All / Attending / Pending / Declined), and **status** (Draft / Scheduled /
Sent). You can mark a message **Sent**.
> ⚠️ **Important:** "Send" currently **records** the message as sent — it does **not**
> actually deliver email/WhatsApp/SMS yet (that's planned for a later update). Treat it
> as a drafting/tracking tool for now and send real messages through your normal channel.

### Music (Dancefloor curation)
Guest **song requests** arrive as *Pending* — each shows the song, who asked, their
dedication, and any resolved link metadata. For each request: **Approve** (onto the
playlist), **Reject**, or **Block** (adds it to the **do-not-play list** for the DJ).
Duplicate requests are grouped automatically with a one-click **Merge**. In the
**Approved playlist** you can **pin** favourites and **reorder** the final running
order. **Export** produces the **DJ pack** — a CSV or printable text file of the
playlist plus the do-not-play list.

### Gallery (moderation)
The photo **moderation queue**. Guest-submitted photos arrive as **Pending**; you
**Approve** or **Reject** them. You can also **upload** photos directly (those are
auto-approved). Filter by All / Pending / Approved / Rejected. Photos only — no video.

### Blessings (moderation)
Guest well-wishes. **Hide/Unhide** any message (hidden ones disappear from the guests'
wall) or **delete** it. Filter by Visible / Hidden.

### Settings
Edit the core wedding details — **couple names, date, ceremony time, venues** — and the
**phase** (see below). Changing these updates what guests see on their dashboard/RSVP.

Settings also has the **Guest Site Theme** dials: the accent colour, deep colour, and
photo-tint strength used across the guest site (with a live preview and a
reset-to-default). Saving applies immediately — no deploy needed.

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
- **Generate invite codes** (Invitations) — that's **couple-only**. You'll see the
  Invitations page, but creating codes will be refused. Ask Ashley or Hazel to issue
  codes (including new coordinator codes).

## Tips
- **Catering numbers:** use the RSVP overview's meal breakdown.
- **Mobile:** the sidebar is behind the **☰ Menu** button.
- Anything broken or awkward? Note it in `docs/FEEDBACK_BACKLOG.md` for the next update.
