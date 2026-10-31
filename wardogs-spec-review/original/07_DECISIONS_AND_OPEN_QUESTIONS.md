# 07 — Decisions and Open Questions

These questions are intentionally visible for the project owner and developer. The proposed defaults allow implementation planning to proceed, but choices affecting access, privacy, or operational workload should be confirmed before launch.

## A. Product and audience

**Confirmed context:** Wardogs UK is an 18+ UK-based community aimed at helping and encouraging members to group up in Wardogs. The specification uses self-attested adult eligibility and UK-focused presentation as defaults; whether membership is restricted to UK residents remains an open policy choice.

1. **Site visibility:** Should all guides/news be public, or should any material require member sign-in?  
   **Proposed default:** Public read access for general resources and join information; sign-in required for member profiles, RSVP, submissions, and reports.

2. **Audience wording:** Is Wardogs a named squad, a broader open community, or both?  
   **Needed for:** Homepage copy, recruitment language, and membership expectations.

3. **Community principles:** What conduct standards and inclusion expectations should be published?  
   **Needed for:** About page and moderation decisions.

4. **18+ enforcement:** Is a registration self-attestation sufficient, or does the owner intend a stronger membership check?  
   **Proposed default:** Private self-attestation at registration, no full date of birth or ID collection. Define a private report/review process for suspected underage accounts.

5. **UK scope:** Does “UK community” mean UK-based/UK time-focused, or must members reside in the UK?  
   **Proposed default:** UK-based and UK-focused, English (UK), `Europe/London` default; no geoblocking unless residency eligibility is explicitly required.

## B. Accounts and identity

6. **Authentication:** What identity provider or existing account system should the site use?  
   **Proposed default:** Reuse existing site auth if secure and maintainable; otherwise select a maintained provider after discovery.

7. **Member verification:** Can any eligible adult create an account, or must access be granted through Discord/moderator approval?  
   **Proposed default:** Open account creation with rate limits unless spam risk or community policy requires approval.

8. **Profile visibility:** Which fields are public versus members-only?  
   **Proposed default:** Public display name and profile only when the member opts in; Steam link explicitly opt-in; email always private.

9. **Steam linking:** Is a profile URL sufficient initially, or is there a requirement for sign-in verification?  
   **Proposed default:** Member-supplied URL with clear “not verified by Steam” label. No OAuth in MVP.

## C. Sessions and events

10. **Ad-hoc expiry:** How long should a “playing now” post remain active?  
   **Proposed default:** Four hours, editable by host, with a hard maximum to avoid stale listings.

11. **Session creation rights:** May all members post sessions, or trusted members only?  
   **Proposed default:** Members can create a limited number of sessions; trusted role gets higher limits/direct publish.

12. **Discord details:** Should event pages link only to the server invite, or can hosts identify voice channels?  
    **Proposed default:** Link public invite or give channel instructions; do not expose private invite tokens.

13. **Time display:** Use `Europe/London` as default, show visitor-local time where appropriate, and make the timezone explicit.

14. **Join policy:** Should a session be open to members, require host approval, or be limited to Steam friends first?  
    **Proposed default:** Let each host choose one and explain each path on the session card.

15. **Direct join capability:** Does the current Wardogs build support friend-join, Rich Presence, lobbies, or a documented launch/join URI for the session types the community uses?  
    **Needed for:** Any one-click “Open Wardogs and join” feature. Run a compatibility spike with the game running/not running and friend/not-yet-friend states. Until verified, ship join requests plus Steam profile/instructions fallback.

16. **Join requests:** Should approval-required squads use in-app request/accept/decline, or start with an external Discord contact?  
    **Proposed default:** In-app request flow for discoverability; Discord remains the coordination fallback.

## D. Resource library

17. **YouTube content types:** Standard videos only, or Shorts and livestream recordings too?  
    **Proposed default:** Standard video/watch and short youtu.be links; decide Shorts treatment in discovery.

18. **Tag list:** Which topics and game terminology should seed the taxonomy?  
    **Proposed default:** Start from the proposed list in delivery doc and allow moderators to evolve it.

19. **Pending submissions:** Should regular members submit resources for review while trusted contributors publish directly?  
    **Proposed default:** Yes; this encourages participation without granting everyone direct publish rights.

20. **Trusted contributor criteria:** Who grants the role and what evidence is sufficient?  
    **Proposed default:** Explicit moderator/admin grant based on reliability, helpfulness, quality, and conduct; reviewable and revocable.

21. **Report threshold:** Should repeated reports temporarily hide a resource automatically?  
    **Proposed default:** No automatic hiding in MVP. Moderator can hide urgently; revisit after report volume is understood.

22. **Comments/ratings:** Should resources allow comments, ratings, or only reports/bookmarks?  
    **Proposed default:** No comments in MVP; consider a simple helpful action later.

## E. Moderation and data handling

23. **Moderator team:** Who will staff the queue and cover absences?  
    **Needed for:** Response expectations and escalation.

24. **Appeal process:** Who reviews an appeal if the original moderator took action?  
    **Proposed default:** Another moderator/admin where possible; otherwise owner review.

25. **Retention:** How long are reports, action logs, and removed content retained?  
    **Needed for:** Privacy notice, account deletion, and operational policy.

26. **Public staff identities:** Which moderators/admins should be named publicly, and which should remain private?

## F. Technology and launch

27. **Existing site/repository:** What framework, hosting, auth, database, and deployment process are currently in use?  
    **Needed for:** Technical implementation plan and effort estimate.

28. **Budget and ownership:** Who owns hosting, maintenance, moderation, and incident response?

29. **Domain and branding:** Is this a dedicated Wardogs subdomain/site, or a section of VainsWorld?

30. **Analytics:** Is privacy-minimal aggregate analytics desired?  
    **Proposed default:** Basic aggregate event counters with no cross-site tracking; no nonessential cookies unless approved.

31. **Server roadmap:** What demand/funding/staffing threshold would trigger evaluation of a private server?  
    **Proposed default:** Treat it as a separately approved future project; the site does not imply a commitment.

## G. Game Wiki integration

32. **Hosting route:** Serve the generated MkDocs site under `/wiki/`, on a branded wiki subdomain, or link to the existing publication initially?  
    **Proposed default:** Same-origin `/wiki/` if the current host supports it cleanly; otherwise a branded wiki subdomain, with a direct link as interim fallback.

33. **Canonical source:** The existing GitHub Knowledge Base remains authoritative for factual game reference. Is that ownership boundary accepted?  
    **Proposed default:** Yes. The community website consumes the generated artifact; corrections go to KB maintainers for review and commit.

34. **Wiki corrections:** Should readers open a GitHub issue/PR suggestion or submit a site form?  
    **Proposed default:** Link to a repository issue or documented feedback route; do not grant the website a write token.

35. **Cross-search:** Launch separate wiki and community search, or provide combined search with clear source labels?  
    **Proposed default:** Keep MkDocs search and Community Guides search separate for MVP; add combined scope only if confidence/version/source distinctions remain visible.

36. **Community-vs-wiki editorial boundary:** Which community-created squad procedures may be promoted into factual reference?  
    **Proposed default:** Keep them in Community Guides unless a KB maintainer assesses sources, versions claims, and commits through the KB process.

37. **Repository publication governance:** Which workflow authorizes publishing the generated wiki site, and who owns deploy credentials?  
    **Needed for:** Least-privilege CI and release rollback. The main website should not need a token with write access to the KB repository.

## Decisions to settle before coding starts

Minimum decisions: current repository/stack; auth and account access; 18+ eligibility method; UK residency scope; public/member visibility; session join policy; Steam/Wardogs join capability; who can create sessions; tag seed list; moderation staffing; data retention; whether YouTube submissions are video-only or also include written resources; and the wiki hosting route/source-of-truth boundary.
