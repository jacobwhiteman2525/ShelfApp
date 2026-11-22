# ShelfVault — Instructions for Coding Agents

## Project purpose
ShelfVault is a game-collection catalog for iOS, built with Expo and React Native. Its defining experience is an interactive virtual bookshelf with physical-game-case-style spines, rather than a generic list of games. Users manage games they own, discover other games, and keep a wishlist. Preserve the distinctive bookshelf experience while improving usability and data quality.

## Repository facts (reviewed November 2026)
- Repository: `jacobwhiteman2525/ShelfApp`; default branch: `main`.
- Current version in `package.json` and `app.json`: **0.3.1**.
- Entry point: `index.js`; most application logic and components currently live in `App.js`.
- Expo / React Native with JavaScript (not TypeScript); AsyncStorage for local persistence.
- Test workflow: VS Code on Windows, Expo Go on iPhone.
- The `README.md` describes an earlier v0.1 prototype and may be outdated; verify implementation against current source before assuming a feature exists.

## Product principles
1. **One comprehensive game-detail experience.** Collection, Wishlist, and Discover should share a consistent game-detail UI and the same available metadata: cover art, title, platform/edition, description, release date, genre, developer, publisher, critic score, user score, and other supported fields. Missing data should be omitted or labeled unavailable, never fabricated.
2. **Collection is a superset.** An owned game's details must show everything shown in Discover/Wishlist **plus** editable personal Notes, ownership information, and shelf management. Never remove metadata from Collection details to simplify the UI.
3. **Status-aware actions.** Discover: Add to Wishlist / Add to Collection. Wishlist: Remove from Wishlist / Move to Collection. Collection: edit Notes and manage shelf membership. Avoid duplicate entries.
4. **Discover shows untracked games.** Hide titles already in Wishlist or Collection; a removed wishlist title becomes discoverable again if it is not owned. For the current local catalog, match by normalized title + platform; later migrate to stable external game/release IDs.
5. **Physical-collection identity.** Preserve realistic game spines, case slide-out animation, shelf themes, custom shelves, and shelf/grid/list views. Distinguish platforms and physical editions where reliable data exists.
6. **Preserve user data.** Never silently reset or replace saved collections. Keep storage keys unchanged without an explicit, tested migration:
   - `shelfvault.expo.library.v1`
   - `shelfvault.expo.wishlist.v1`
   Existing shelf IDs, game IDs, notes, theme, sort order, and wishlist entries must remain readable.

## Current implementation to preserve
- Seeded Nintendo Switch and PlayStation 4 libraries, plus a limited local Discover catalog for additional consoles.
- Collection shelves, Wood/Modern themes, Shelf/Grid/List views, A–Z/Z–A/manual sorting, long-press/tap-to-position shelf ordering, and custom shelf membership.
- Separate Collection, Wishlist, and Discover tabs.
- Wishlist persistence and transfer into Collection.
- Shared `GameDetail` component with optional metadata, a cover placeholder/fallback, context-aware actions, and a collection-only Notes editor.
- Multiline Notes and iOS keyboard avoidance/scroll behavior were specifically debugged with the user; treat regressions here as high priority.

Verify exact behavior in current code and on-device before claiming a feature is complete. Do not assume that a UI placeholder represents a connected service.

## Roadmap and status
### Near term
- Test and refine v0.3.1 interactions and unified game details.
- Introduce real game metadata, cover artwork, and search with platform filtering.
- Support reliable popularity, Metacritic critic score, and user-score sorting **only where a provider supplies appropriately licensed/available data**. Show score source and missing-data behavior; do not invent values.
- Improve add-game flow with title search and a manual fallback.
- Add barcode scanning for physical games (UPC/EAN), including lookup of the correct platform and edition; scanning alone does not identify the game without a barcode database.

### Later
- More consoles, precise physical editions, better manual shelf arrangement / drag-and-drop, custom shelf themes, imports/exports, backup/sync, collection condition/valuation, and performance/accessibility improvements.

## Engineering guardrails
- Inspect the existing project before editing. Make small, focused, reviewable changes; avoid replacing the entire `App.js` unnecessarily.
- Refactor into separate components/modules gradually when helpful, preserving behavior and storage compatibility.
- Never embed private API credentials in the React Native client. Use a secure backend/proxy for providers that require secrets.
- Treat game metadata as optional and normalize provider data in one place. Differentiate game identity from specific platform/release/edition identity.
- Respect artwork licensing, attribution, and API usage terms.
- Avoid duplicate records when moving between Wishlist and Collection; preserve personal notes and shelf membership.
- Prefer actionable errors and loading/empty states over silently failing.
- Before claiming success, run available checks (e.g. `npx expo install --check` and relevant tests) and state clearly which checks were or were not executed. Verify on iPhone/Expo Go for keyboard and touch interactions.
- Do not overwrite local user data, modify storage keys, or introduce dependencies without explaining why.

## Working with the project owner
The owner plans features and reviews designs in ChatGPT, and uses Codex in VS Code to implement/test changes. GitHub is the shared record of **committed** code, not unsaved local edits. Confirm feature expectations before large UI changes. Preserve established decisions rather than substituting generic game-library conventions.

When completing a coding task, summarize:
1. Files changed and why.
2. User-visible behavior.
3. Storage/dependency implications.
4. Checks run and manual Expo Go test steps.
5. Known limitations and next steps.
