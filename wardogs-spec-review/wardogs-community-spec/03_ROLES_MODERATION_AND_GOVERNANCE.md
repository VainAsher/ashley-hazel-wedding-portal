# 03 — Roles, Moderation, and Governance

## 1. Access model

Use capabilities/permissions assigned through roles. A user may hold more than one role. The application should check permissions on the server for every protected action; hiding a button in the UI is not authorization.

The community is 18+. Require a private age attestation before enabling member participation (profiles, squad listings, RSVP, submissions). The public Game Wiki may remain readable without an account. The MVP should not collect or retain full dates of birth or identity documents. A credible report that an account may be under 18 should enter a restricted moderator case; do not disclose the report publicly, and follow a defined review and account restriction/removal procedure.

### Suggested roles

| Role | Intended use | Typical permissions |
|---|---|---|
| Visitor | Not signed in | View public pages and public resources; join links |
| Member | Signed-in community member | Manage own profile, RSVP, create sessions if enabled, report content, submit resources to review |
| Trusted contributor | Member with explicit trust grant | Publish/edit own resources and sessions directly; all member rights |
| Editor | Content team | Create/edit/publish news and Community Guides content; review pending submissions; manage resource metadata |
| Moderator | Safety and content review | Triage reports, hide/restore/remove content, correct metadata, apply limited restrictions |
| Administrator | Platform/community owner | Manage users, roles, settings, tags, retention, and moderator actions |

Do not make “Steam linked” a prerequisite for member status or trusted contributor status.

## 2. Permission catalog

Suggested permission identifiers:

- `profile.read_public`, `profile.read_members`, `profile.update_own`, `profile.moderate`
- `session.create`, `session.publish`, `session.update_own`, `session.join`, `session.moderate`
- `resource.submit`, `resource.publish_direct`, `resource.update_own`, `resource.review`, `resource.moderate`
- `report.create`, `report.read_queue`, `report.resolve`
- `content.news_edit`, `content.news_publish`
- `taxonomy.read`, `taxonomy.manage`
- `user.role_read`, `user.role_assign`, `user.restrict`
- `audit.read`, `settings.manage`, `data.export`, `data.purge`

Separate higher-risk administrator actions (role assignment, permanent purge, export) from routine moderator actions. Where feasible, require a reason for role grants, restrictions, permanent purge, and content removal.

## 3. Reporting system

Reportable targets for MVP: video/resource, session/event, member profile, news/highlight. Comments are not in initial scope; if added, comments become reportable and need rate limits and moderation controls.

Report reasons:

- Broken or unavailable link
- Incorrect, misleading, or outdated information
- Wrong tags / duplicate
- Spam or unrelated promotion
- Harassment or inappropriate content
- Privacy or safety concern
- 18+ eligibility concern (restricted to moderators/admins; never shown on the public profile)
- Other (short explanation)

Report behavior:

- One active report per reporter/target/reason window, with abuse rate limits.
- Reports do not reveal reporter identity to the reported contributor by default.
- Report volume is a triage signal only; it does not automatically prove a violation.
- Moderators can combine duplicate reports into a single case while retaining count and reporter records under privacy rules.
- Urgent concerns can be hidden pending review; every hide must be reversible and logged.
- A report may be resolved as dismissed, corrected, hidden, removed, or escalated.

## 4. Moderation queue

Queue filters: new, urgent, awaiting action, resolved, reopened; target type; reason; report count; age.

Case view should show:

- Target content and current visibility/status
- Report reason and explanation
- Prior reports and prior moderation actions, subject to role
- Contributor identity and content history
- Available actions with impact explained
- Private moderator notes
- Resolution reason and notification setting

## 5. Content lifecycle

Resource states (the authoritative transition table is `04` §6):

`draft → (pending → rejected | published) → needs_review | outdated → hidden → removed → purged`, with moderator restore from `hidden` and administrator restore from `removed` within the retention window.

- **Draft:** visible only to its author.
- **Pending:** awaiting review by an editor/moderator (only when pending review is enabled for non-trusted members).
- **Rejected:** not published; the contributor sees the reason and may edit and resubmit.
- **Published:** searchable and viewable according to visibility.
- **Needs review:** remains viewable with a warning or is temporarily hidden according to moderator choice.
- **Outdated:** retained for reference but clearly labeled; may be excluded from default “current” results.
- **Hidden:** not shown publicly; recoverable by moderators/admins.
- **Removed:** removed from normal views but retained in a restricted moderation archive for a documented period; an administrator can restore it during that period.
- **Purged:** irreversible deletion, separate from normal moderation and subject to applicable retention/legal needs.

“Delete” by a member should generally mean remove their own submission from public view, with an understandable retention notice. If the entry is essential to an unresolved case, retain only the minimum necessary moderation record.

## 6. Discipline and appeal

Use proportionate, context-aware actions:

1. Guidance or correction request.
2. Content correction or removal.
3. Time-limited loss of direct publishing or session-creation permissions.
4. Temporary account restriction.
5. Role removal or account suspension for repeated or serious conduct.

Every restriction stores reason, actor, start/end time, affected capabilities, and review/appeal route (modelled as `UserRestriction` in `04`). When several restrictions overlap, a capability stays removed until every restriction that removes it has expired or been lifted. Avoid a public punishment ledger. A member should be notified privately, with enough detail to understand the decision and request review. For serious cases, a second moderator/admin should review where available.

**Small-team fallback:** A moderator does not review an appeal against their own action and does not act on reports about themselves or someone they have a declared conflict with. If no independent moderator/admin is available, the owner reviews; if the owner took the original action, publish a named alternative reviewer (for example, a trusted senior member with read-only case access) or state honestly that appeals are reviewed by the owner after a cooling-off period. Record the reviewer and outcome in the case.

## 7. Trust and reputation

Keep constructive recognition distinct from permission and discipline:

- Possible positive signals: accepted guides, helpful corrections, hosted sessions, sustained useful contributions.
- Do not display raw negative scores or let users downvote contributors.
- Do not auto-promote users solely by activity count or vote count.
- Trusted-contributor status is explicitly granted by authorized staff, based on published criteria such as reliability, quality, conduct, and time contributing.
- Review role grants periodically and allow revocation with an audit reason.

## 8. Audit log

Record at minimum: actor ID, action, target type/ID, before/after values where appropriate, reason, timestamp, request/correlation ID, and whether a notification was sent. Restrict access to moderators/admins. Do not store unnecessary sensitive information in free-text notes. Log role and permission changes, report resolutions, content visibility changes, tag edits, and permanent purges.

## 9. UK legal obligations (to confirm before launch)

The site hosts member-generated content (profiles, session listings, guides, reports), so it is likely a user-to-user service under the UK Online Safety Act 2023. Governance must cover the duties summarized in `05` §7A: an illegal content risk assessment, a children's access assessment, accessible reporting and complaints routes, and terms that explain them. Ofcom's guidance treats self-declaration of age as insufficient on its own to show that children cannot access a service, so the 18+ attestation is a community eligibility rule, not proof of age. Moderators need a documented route for illegal content (for example, threats or child sexual abuse material) that escalates to the owner and, where required, to the appropriate authority, separate from ordinary content disputes. Confirm current Ofcom and ICO guidance; treat this section as a checklist, not legal advice.

## 10. Abuse controls

- Rate limit session creation, reports, and submissions.
- Validate and normalize YouTube/Steam links; reject unsafe schemes and unrelated hosts.
- Prevent users from escalating their own role or modifying another user’s permission.
- Keep audit logs append-only from the application perspective.
- Require elevated permission for exports and permanent deletion.
- Provide a way to temporarily disable new submissions or session creation during an incident.
