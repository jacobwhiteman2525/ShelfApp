# ShelfVault — Product Feature Wishlist

Status: **ideas and candidate features, not commitments or implemented functionality**. Updated November 2026. This is a living document for design discussions; prioritize and scope before implementation. See [Architecture and Roadmap](ARCHITECTURE_AND_ROADMAP.md).

## Priority idea: one library for physical AND digital games

**Problem:** A physical-only virtual bookshelf leaves digital purchases invisible. ShelfVault should let collectors represent their *entire* library on shelves, without pretending digital licenses are physical cartridges/discs.

**Desired experience**
- Add games as **Physical**, **Digital**, or **Both**; track platform, storefront, edition and region where applicable.
- Show digital games on virtual shelves as clearly identifiable **digital cases/tiles/spines**, customizable separately from physical cases. Never imply a digital title is a physical box owned by the user.
- Filter shelves by All / Physical / Digital, by console/storefront, and by owned versus wishlist.
- A single game can have multiple ownership records (e.g. physical Switch + digital Steam, or both formats on the same platform), without losing notes, play status, shelves or duplicates that are intentional.
- Manually add digital purchases first; **account linking and imports are optional future enhancements**, not prerequisites.
- Distinguish owned/purchased, claimed, subscription-access, family-shared and no-longer-accessible licenses where data is available. Avoid representing temporary subscription access as permanent ownership.
- Digital entries may use storefront artwork or a stylized digital spine; physical entries use verified platform-specific box art. Never mislabel screenshots as box covers.
- Include user controls for hiding individual imported games, removing a connection, refresh, and preventing duplicate imports.

## Storefront and platform integration wishlist

| Integration | Long-term idea | Feasibility and limitations to investigate |
| --- | --- | --- |
| **Steam** | Connect account and import accessible owned games, playtime and optional achievements where authorized | Steam Web API offers some owned-games functionality subject to account privacy and API terms; private libraries may be unavailable. Design account authorization carefully; never request a Steam password or scrape credentials. |
| **Epic Games Store** | Import purchased/claimed titles into digital shelves | Do not assume an official public library API or third-party OAuth scope is available; research approved options and allow manual/authorized export-import fallback. |
| **GOG** | Add GOG purchases and optional account-based sync | Verify documented account/library access and terms; support manual import if needed. |
| **Xbox** | Link Xbox/Microsoft account to discover owned digital titles, subscriptions, and achievements | Official user-library access may be restricted; verify permitted scopes, platform approval, and data coverage before promising integration. |
| **PlayStation** | Connect PSN account to show eligible purchased/downloaded games and trophies | Access to purchase entitlements may be restricted; public profiles/trophies are not proof of ownership. No unauthorized scraping or credential collection. |
| **Nintendo** | Link Nintendo Account to show eligible eShop purchases and Switch library | Public third-party purchase-library access may be unavailable; treat as exploratory, with manual entry/import fallback. |
| **Other PC launchers** | EA app, Ubisoft Connect, Battle.net, itch.io and others | Prioritize only when permitted access and meaningful user demand exist. |

**Research before building:** API availability, commercial permissions, authentication/OAuth scopes, privacy controls, sync quotas, data retention, revoked access, regional storefront IDs, and the difference between an account's installed games, played games, claimed games, and actual entitlements. No passwords, browser-cookie extraction, reverse-engineered private APIs, or misleading ownership claims.

## Other feature wishes

### Collection and shelf experience
- Authentic physical front covers by platform, edition and region; verified spines where licensed; generated ShelfVault spines as a fallback.
- Digital shelf styles: subtle digital badge, virtual game cards, customizable spine artwork, optional separate digital shelf/room.
- Shelf themes, lighting, case size differences, favorites/display shelves and richer rearrangement.
- Barcode scanning for physical UPC/EAN; manual fallback and edition disambiguation.
- Collection export, backup, restore, optional cloud sync and offline-first use.
- Game status and personal metadata: played, backlog, completed, favorites, purchase date, condition, notes.
- Future: optional valuation and collection analytics, with appropriately sourced price data.

### Discovery and data independence
- ShelfVault-owned canonical game IDs with external providers as replaceable metadata and artwork sources.
- Better search, release calendars, accurate cover matching, aliases and regional editions.
- Explicit-content filtering in unsolicited discovery, with intentional searches still supported.
- Provider attribution that meets licensing requirements without dominating game details.

### Community (later)
- User profiles, public shelves, following and sharing.
- ShelfVault-native ratings, reviews, most-owned, most-wishlisted and trending metrics.
- Moderation, content controls, anti-spam, account privacy and data portability.

## Proposed sequencing

1. **Now: v0.4** — stabilize live discovery, legacy metadata linking, and accurate physical front covers.
2. **v0.4.5** — provider-independent catalog and ownership model design; explicitly reserve Physical/Digital/Both and multiple entitlement records in schema.
3. **v0.5** — physical barcode/edition identification.
4. **v0.6** — authentic/generated spine artwork and enhanced physical shelf design.
5. **Future digital-library milestone (scope/date TBD)** — manual digital entries, distinct digital shelf representation, import/export; Steam integration feasibility and prototype.
6. **Later integrations** — Steam account sync if authorized, Epic/GOG, then exploratory PlayStation/Xbox/Nintendo based on actual permitted APIs.
7. **Later community milestone** — social profiles, community metrics and reviews.

Digital representation is a **high-priority product goal**, but no storefront account integration is promised until its technical and legal feasibility is verified.

## Guardrails

- Preserve existing Collection/Wishlist records and AsyncStorage keys; migrate additively with backups/tests.
- Never silently merge different platforms, editions, storefronts, or physical/digital ownership records.
- Treat external storefront identifiers as mappings, not canonical ShelfVault IDs.
- Account connections must be opt-in, revocable, least-privilege and secure; never store account passwords.
- The app must remain useful without any connected account, with offline/local records authoritative for personal organization.
- This document is planning only: no code or account integration is implemented by this PR.
