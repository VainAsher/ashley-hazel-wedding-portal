# 08 — Game Wiki Integration Specification

## 1. Purpose

Make the existing [WARDOGS Game Knowledge Base](https://github.com/VainAsher/wardogs-game-knowledge-base) a first-class part of the Wardogs community website. The user should experience a coherent community site with a **Game Wiki** navigation area, while the Knowledge Base repository remains the authoritative source for factual game reference.

## 2. Verified repository baseline

Repository contents reviewed on 31 October 2026:

- README describes an unofficial, evidence-based, source-cited reference for gameplay, combat, vehicles, economy, maps, and server administration.
- `MASTER_INDEX.md` is the catalogue consumed by the generated site and exports.
- Article Markdown uses YAML frontmatter with fields such as stable document ID, title, version, status, confidence, category/topic, game version, created/updated/review dates, source verification date, related document IDs, and tags.
- `scripts/build_site.py` generates `mkdocs.yml` and `docs/index.md` from the catalogue; the repository explicitly says not to edit those generated files by hand.
- MkDocs Material provides navigation, search suggest/highlight, tables, admonitions, Mermaid diagrams, and in-page table of contents.
- At the latest repository status reviewed, 30 documents were frozen at Season 02 / Update 0.2.0, supported by a dated 2026-10-30 snapshot. This is a dated baseline, not a value to hard-code.
- Repo status calls out uncertain/low-confidence topics, source conflicts, unconfirmed claims, stale-data gaps, and a follow-up review date. The wiki should preserve these distinctions rather than flattening them into unqualified prose.
- README documents that full third-party post/store text is kept local and gitignored; the public repository tracks indexes/hashes. Deployment must follow this content boundary.

## 3. Information architecture

Main navigation should expose these as distinct destinations:

- **Game Wiki** — source-cited factual/reference knowledge maintained in the KB repository.
- **Community Guides** — videos, squad procedures, drills, loadouts/setups, and member-authored practical advice.

The current wiki's catalogue grouping is suitable for its landing page:

1. Category foundations
2. Depth documents
3. Reference data and tables
4. Additional classes/categories as the repository evolves

Within the wiki, retain the repository's category navigation (gameplay/modes, combat/loadouts, economy, maps/environment, meta/release, technical/servers, vehicles/outposts). Generate all counts and category lists from the repository catalogue.

## 4. Content authority and editorial separation

### Game Wiki

- Maintained through the Git repository and its evidence/citation/version workflow.
- Factual claims retain citations and scope/version qualifiers.
- Knowledge-base maintainers review corrections and publish changes through repository commits and the existing build/release pipeline.
- Community site users can suggest corrections but cannot directly edit canonical wiki content through the website.

### Community Guides

- Owned by the community site and its contributor/moderator roles.
- Includes authored practice, opinions, drills, videos, AARs, and recommended setups.
- Uses its own reporting, correction, and removal lifecycle.
- Must not display KB confidence ratings or imply developer endorsement.

Where a community guide depends on factual mechanics, it may link to one or more wiki document IDs. A KB article may link to community material as an example/application, but this link must be labeled as community-created.

## 5. User-facing page behavior

### Wiki home

- Clear statement that the resource is an unofficial fan reference and the game changes during Early Access.
- Search box using the existing MkDocs search index.
- Category/tier browse and repository-generated coverage summary.
- Link to community guides for applied training material.
- “Suggest a correction” route that points to the selected maintainer-approved feedback path.

### Wiki article

Preserve and make legible:

- Article title and stable ID (stable ID may be in page metadata or accessible details).
- Document version and status.
- Confidence level and market/scope where supplied.
- Applicable game version/build and source verification date.
- Updated and review-due date.
- Citations and source links.
- Related documents and patch-sensitive caveats.
- Unofficial-reference notice (delivered by the KB theme override if not already present in page content).

Do not rewrite or remove caveats as part of site branding. Brand the surrounding shell/header/footer while keeping article attribution and source links intact.

## 6. Deployment architecture

The wiki is a static generated artifact; the community app is a dynamic application. They may share navigation and branding while retaining independent build/deploy processes.

### Preferred route

Host generated MkDocs output under the main site origin at `/wiki/`. Preserve assets and routes, configure the base path correctly, and verify direct deep links and refreshes. Use a route/proxy/static artifact mount that does not require copying article content into the app's database.

Configuring the base path is a change in the KB repository: `site_url` lives in the generated `mkdocs.yml`, so `scripts/build_site.py` must accept the base URL as an input (keeping the current Pages URL as the default) rather than anyone editing the generated file. See `05` §1A.

### Fallback route

Host at a branded wiki subdomain, with a shared visual header or clear reciprocal links. During transition, retain the current published knowledge-base URL as the destination. Keep the main-site Game Wiki navigation stable even if the underlying wiki host changes.

### Knowledge Base repository changes and ownership

Integration needs a small number of changes inside the KB repository. They are made and reviewed by a named KB maintainer through the normal KB workflow, not by the community-site developer with a write token:

1. Generator input for the base URL (`site_url`) and, if needed, an alternative publish target.
2. A MkDocs Material theme override (`overrides/`) that adds the community-hub header/footer link and the per-page “Unofficial fan reference — verify against the current game version” notice where the existing pages do not already show it (FR-048).
3. Optional emission of a machine-readable catalogue (for example, JSON generated from `MASTER_INDEX.md` and frontmatter) if cross-search or article cards are built (`04` *Wiki catalogue projection*).

Until these land, the interim route is the current published KB URL with a reciprocal link.

### Repository build pipeline

1. KB source commit updates the generated catalogue and MkDocs build through the repository's existing workflow.
2. Existing checks validate docs, references, and generated output; deployment receives a preview or staging step.
3. A release publishes static files and records the source commit/build identifier.
4. Optional community-site catalogue/search artifacts are generated from the same source commit and deployed as read-only data.
5. Rollback selects a prior known-good static artifact; it does not require rolling back the community app database.

Use read-only access to the public KB repository if the site fetches or indexes metadata. The site must not hold a GitHub credential capable of writing to the KB repository.

## 7. Search and cross-linking

### MVP

- Keep MkDocs search dedicated to Game Wiki content.
- Keep the application search dedicated to Community Guides/resources.
- Add relevant wiki links to community guides manually using stable document IDs or canonical article paths.
- Provide “Related Community Guides” links only when curated and available.

### Later optional combined search

Build a generated read-only index at KB release time. Each result includes `source_type`, title, summary, canonical URL, stable ID, document version, game version, confidence/status, and update date. Community results include author and moderation/published status. Add visible source labels and scope filters. The ranking must not suggest community-authored material is verified fact.

## 8. Correction and contribution workflow

- “Suggest a correction” opens the repository issue/feedback route with article ID and URL prefilled, or a site form that routes to designated KB maintainers.
- A report of a wiki error should not invoke the community resource takedown lifecycle automatically. It creates a knowledge-base correction item.
- Community videos and guides can be submitted and moderated through the website as already specified.
- If a contributor's guidance is promoted into a factual article, a KB maintainer must verify sources, version applicability, confidence, and wording before committing it.

## 9. Operational and content safeguards

- Never hard-code document counts, game version, current patch, release dates, confidence aggregates, or review dates into the main app.
- Never publish gitignored local snapshots or raw third-party source text outside the repository's approved release policy.
- Display stale/review-due metadata as supplied; do not silently label an expired review date “current”.
- If the wiki host is unavailable, the main website remains usable and may show a graceful link/retry message.
- If the KB build fails, do not replace the last known-good published wiki with an empty or partial site.
- Keep canonical article URLs stable where possible; redirects are needed when repository paths change.

## 10. Release acceptance checklist

- Main navigation opens Game Wiki; wiki header/footer provides a return link to the community hub.
- Search and direct article deep links work after deployment under chosen path/host.
- MkDocs assets, theme, anchors, citations, and Mermaid diagrams render correctly.
- Article metadata and uncertainty notices remain visible on mobile and desktop.
- Article link and title match repository catalogue ID/path.
- Generated article counts reflect the deployed commit, not stale app configuration.
- Community Guides and wiki articles have distinct visual source labels and separate edit/report workflows.
- Main app remains operational if the wiki build or host is temporarily unavailable.
- Last-known-good deployment and rollback commit are identifiable.
