# ShelfVault — Architecture, Product Direction, and Roadmap

Status: **proposed target architecture**, not a claim that all components are implemented. Updated November 2026.

## Product vision

ShelfVault is a video-game collection experience built around virtual shelves and game cases, beginning with physical games and ultimately representing **both physical and digital libraries**. It will evolve into an independent game catalog and community: users own their collection, wishlist, shelves, notes, ratings, reviews, and social identity. External services are *replaceable enrichment providers*, not the identity or source of truth for a game.

Guiding principles:
- Collection and Wishlist must remain useful offline and when any external API is unavailable.
- Do not require manual entry of every new game: ingest permitted metadata from multiple sources and reconcile it into a ShelfVault catalog.
- Preserve platform, edition, region, storefront, and ownership-format distinctions. A game title is not the same as a physical release, digital license, or subscription entitlement.
- Treat images, game facts, community metrics, and critic scores as different data types with distinct sources, provenance, refresh policies and licensing.
- Never silently replace users' notes, shelf order, manually entered titles, or other personal information.
- Explicit sexual games must not appear in unsolicited discovery; intentional exact-title searches may find them. Classification is best-effort, not infallible.

## Current state (v0.4 development)

Expo/React Native app; Collection, Wishlist, Discover; shelf, grid and list views; configurable shelves, themes, sorting, drag/rearrangement, shared game detail modal, notes, and local AsyncStorage persistence. Discover uses a local Node proxy to fetch RAWG game data; optional TheGamesDB front-cover lookup is supported when configured. RAWG IDs and RAWG ratings are currently used for linked metadata. This is transitional, **not** the desired final catalog architecture.

Current user-data storage keys — do not change or clear without a verified migration:
- `shelfvault.expo.library.v1`
- `shelfvault.expo.wishlist.v1`

Current proxy is for local development, not production user authentication or a production-scale catalog service. Metadata linking for legacy saved games and box-art coverage are still being improved.

## Target architecture

```text
External metadata providers: RAWG / IGDB / other licensed sources
Artwork providers: physical front covers / permitted spine scans
Critic scores: appropriately licensed source
              | provider adapters + attribution/licensing checks
              v
ShelfVault ingestion / reconciliation / provenance / refresh jobs
              |
              v
ShelfVault canonical catalog (games, platforms, releases, editions, artwork references)
              |
              +---- ShelfVault community data (future: accounts, ratings, reviews, follows)
              |
              v
ShelfVault API / search / caching / content policy
              |
              v
Mobile app: local-first physical + digital Collection, Wishlist, shelves, notes and offline cache
```

**Separation of concerns**
1. **Catalog identity:** internal immutable ShelfVault game ID; separate platform-specific release/edition ID and platform ID. External IDs live in an association table, e.g. `(provider, external_id, entity_type, shelfvault_id)`.
2. **Metadata:** title, aliases, description, release dates, genres, developer/publisher and content classification, with field-level source/provenance, update timestamps and confidence. Do not overwrite verified/user-owned fields blindly.
3. **Artwork:** `frontCover`, `spine`, `background/promotional` are separate asset roles. Each artwork record has platform, region, edition, provenance, license/usage constraints, dimensions, verification state and optional attribution. A promotional screenshot is NEVER labeled or framed as physical box art.
4. **Critic scores:** Metacritic critic score remains externally sourced and separately labeled; check rights and attribution. RAWG community rating is not a ShelfVault rating and is not a Metacritic user score.
5. **Community metrics:** ShelfVault ratings, review counts, collection counts, wishlist counts and trending metrics must eventually derive from ShelfVault activity, with abuse prevention and privacy controls. Do not build these in v0.4.
6. **Personal data:** collection records, notes, shelf membership/order, wishlist and user edits remain authoritative for the owner. Migration to cloud sync requires opt-in, conflict resolution, backup/export and recovery.
7. **Ownership records:** model physical copies, digital licenses, and temporary subscription access as distinct holdings linked to a canonical game/release, platform and optional storefront. Support multiple holdings of the same game without conflating them or silently deduplicating them.

## Future digital-library architecture

**Digital representation is a product priority, not an implemented feature.** The same virtual shelves should eventually display clearly differentiated digital game cases/tiles/spines alongside physical cases, with filters for ownership format, platform and storefront. Manual digital entry should work even without external account access. Physical box art and digital storefront artwork have different roles; do not portray a digital license as a physical copy.

**Storefront connectors are optional adapters, separate from game metadata providers.** A connector may import a user's authorized entitlements into ShelfVault ownership records, while the ShelfVault canonical game ID remains stable. Model `ownershipType` (physical/digital/subscription or other permitted access), `platformId`, `storefrontId`, `externalEntitlementId` where available, access status, source, last-sync time, and user overrides. Keep imports idempotent and distinguish purchased/claimed/installed/played/subscription access; these are not equivalent. Never delete a user's manually maintained record because a provider stops returning it.

**Integration feasibility:** Steam is an early candidate for authorized library import, subject to Steam privacy settings and API/terms. Epic Games Store and GOG require research into supported account-library access; do not assume a public import API exists. PlayStation, Xbox and Nintendo account-library integration is a long-term research goal only: entitlement APIs may be restricted or unavailable to third parties. Do not use credential scraping or request passwords. Connections must be opt-in, revocable, least-privilege and backed by secure server-side token handling when needed. Manual entry and export/import remain fallbacks.

See [Feature Wishlist](FEATURE_WISHLIST.md) for the digital-library user experience and broader ideas.

## Provider independence

Use provider adapter interfaces (search, detail, platforms, artwork, score, source metadata) and a normalized domain model. Keep raw provider IDs separate from canonical IDs. Reconcile using title aliases, platform, release date, edition and region, with a confidence threshold and human confirmation for ambiguous matches. Avoid fuzzy matching that conflates remasters, compilations, ports or editions. Cache permitted results with TTL and offline fallback. A provider outage should degrade enrichment, not break saved collections. Do not bulk-republish or permanently mirror restricted provider data without permission. Confirm each source's terms before deployment or redistribution.

A persistent ShelfVault catalog and backend are future work; the current local proxy and AsyncStorage are not that backend. Design schema/migrations before introducing accounts or syncing users' collections.

## Artwork quality contract (high priority)

- **Front cover:** verified physical front-cover image for the selected platform and ideally region/edition. Preserve correct portrait or platform-specific aspect ratio. Do not fill a portrait cover slot with a cropped gameplay screenshot or landscape promo art.
- **Fallback when no verified cover:** branded, readable ShelfVault placeholder with title/platform. Optionally offer a separately labeled promotional image elsewhere in detail, never as the physical front cover.
- **Spine:** prefer permitted authentic spine scans with matching platform/region/edition; otherwise generate a coherent ShelfVault-style spine using verified title/logo and platform branding. Support personal overrides/uploads later. Do not fabricate an exact physical reproduction.
- **Artwork resolution order:** user-selected override (future) > verified platform/edition cover > verified game-level cover if applicable > placeholder. Background/promotional assets are not cover candidates.
- **UI:** make portrait cover prominent on the left of the shared detail header across Collection/Wishlist/Discover. Keep long descriptions collapsed to four lines by default with expand/collapse.
- **QA:** test Banjo-Kazooie (Nintendo 64), Pikmin 1+2 (Switch), different ports, missing assets, regional variants, offline behavior, old local records, and licensing attribution.

## Attribution and compliance

Current RAWG API terms require attribution/linking when using RAWG data. Do not remove mandatory attribution while continuing to display its data. **UX goal:** remove repetitive, intrusive RAWG links from the hero/detail flow by moving required credit to a small, clearly accessible source/info area or a persistent Discover footer, *only where this still meets the provider's requirements*. Verify terms before changing placement. If terms require per-item credit, preserve it or replace the source with one whose license permits the desired experience. TheGamesDB and other sources have their own rights and attribution rules. Maintain provenance in data even when UI credits are consolidated.

## Discovery and safety

Default discovery sections: Popular, New Releases, Upcoming, Top Rated, with live search, platform filtering, pagination, caching and network/error states. Initially rankings may reflect RAWG and must be labeled as such; eventually transition to ShelfVault-native collection/wishlist/rating signals once the community is sufficiently large. Avoid implying external popularity equals sales or ShelfVault popularity. Exclude identified explicitly sexual games from unsolicited discovery and autocomplete, but permit intentional precise searches; retain user-owned entries. Keep safe and intentional search caches separate and disclose filtering limitations.

## Roadmap (sequence, not dates)

### v0.4 — Stabilize live discovery (in progress)
- RAWG live search, filters, upcoming games, pagination, caching, ratings and safe discovery.
- Reliable on-demand enrichment of legacy Collection/Wishlist games without losing saved fields.
- Fix front-cover accuracy and placeholders; stop presenting screenshots as box art.
- Improve game-detail artwork prominence, expandable description, and unobtrusive compliant attribution.
- Validate Expo Go proxy/network behavior, old data migration and offline states.

### v0.4.5 — Independence architecture
- Specify canonical game/release/platform/edition IDs, provider crosswalk, provenance, artwork roles and content policy.
- Reserve schema support for multiple physical/digital ownership records, storefront mappings, and temporary subscription access without building account sync yet.
- Introduce provider-agnostic interfaces and migration plan from provider-linked local records.
- Evaluate licensing and hosting economics; choose future persistent catalog/backend only after a technical design review.
- Preserve AsyncStorage keys and provide tested migration/rollback/export plan.
- No premature community backend or forced cloud account.

### v0.5 — Physical game identification
- Barcode UPC/EAN scanning; disambiguate region/platform/edition and handle compilation/collector variants.
- Manual entry and correction when barcode lookup fails.
- Improve platform-specific front cover retrieval and verified matches.

### v0.6 — Physical shelf experience
- Authentic spine-art sourcing where permitted; high-quality generated spine fallbacks.
- Artwork overrides, edition/region customization, improved shelf layouts and organization.
- Export/backup and further collection management improvements as scoped.

### Future — Digital shelves (without account connections)
- Add manual digital ownership records and clearly differentiated digital cases/spines, with Physical/Digital/All filters and multiple ownership formats per title.
- Support local-first digital entries and optional export/import without requiring a Steam, Epic, console, or other external account.

### Next — ShelfVault community and social features
- Introduce optional ShelfVault accounts, optional cloud sync, public collections, profiles, follows, sharing, ratings, reviews and moderation.
- Build ShelfVault-native popularity, trending, most-owned and most-wishlisted rankings from consented community activity.
- Establish privacy, safety, moderation, anti-spam, content preferences and data portability before launch.
- **Ship community and social capabilities before implementing external storefront or console account connections.**

### Later — External account and game-library integrations
- Research authorized Steam library import first, with explicit privacy/permission and import-deduplication design.
- Explore Epic Games Store and GOG only where supported account-library access exists.
- Treat PlayStation, Xbox and Nintendo account connections as long-term feasibility research, not guaranteed features.
- Keep local-first use, manual entry, and revocable opt-in connections.

## Engineering guardrails

- Do not rewrite the app from scratch.
- Keep current personal storage keys stable; make migrations additive, tested, recoverable.
- Distinguish game-level metadata from platform/release-level physical artifacts, digital storefront artwork, and user ownership/entitlement records.
- Keep secrets out of Expo client bundles; current development proxy token is not production auth.
- Test old saved collections, notes, shelf membership/order, duplicate detection, keyboard behavior, modal dismissal, offline caching, content filtering and artwork fallbacks.
- For future work, design and discuss changes before Codex implements locally. This document PR is specifically authorized; no further GitHub writes without explicit permission.
