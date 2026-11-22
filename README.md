# ShelfVault v0.4

See [RAWG setup and iPhone verification](RAWG-SETUP.md) to run the local discovery proxy. The prototype notes below describe the original release.

## ShelfApp v0.1 prototype

An iPhone-friendly prototype of a game library that looks like real shelves. This is a new React Native implementation of the earlier SwiftUI concept; it does not import the SwiftUI code or its on-device saved data.

## Setup on Windows 10

1. Install **Node.js LTS** from https://nodejs.org/ and **Visual Studio Code** from https://code.visualstudio.com/.
2. Install **Expo Go** on your iPhone from the App Store.
3. Extract this ZIP, open the `ShelfVault-Expo` folder in VS Code, and open **Terminal → New Terminal**.
4. Run `npm install` (internet required).
5. Run `npx expo start`.
6. Make sure your iPhone and Windows PC are on the same Wi-Fi network. Scan the terminal's QR code with the iPhone Camera and open it in Expo Go.
7. If the LAN connection fails, stop the server with Ctrl+C, run `npx expo start --tunnel` (may prompt you to install `@expo/ngrok`), then scan the new QR code.

### Notes
- Expo SDK 54 and its pinned compatible dependencies are configured in `package.json`. Check current Expo Go compatibility if running a different Expo Go version.
- Run `npx expo install --check` to verify package compatibility after installing.
- If PowerShell blocks npm scripts, open **Command Prompt** as your VS Code terminal and run the commands there instead.
- Expo Go is for development/testing; distributing a standalone iOS app requires a separate cloud build and Apple signing.
- The project does not include copyrighted game artwork. Spines and covers are generated placeholders.
- No barcode scanning, API game lookup, cloud backup, or valuation yet.

## Using the app
- Shelf, Grid, and List toggle at the top.
- Wood / Modern toggles shelf styling.
- Sort cycles through Manual → A–Z → Z–A.
- Tap a game spine to reveal a placeholder case, edit notes, and add it to custom shelves.
- **Long-press** a spine to select it for moving. Tap a target spine to insert before it, or **+ End** to append. This is a two-step touch-friendly reordering interaction, not freeform drag-and-drop yet.
- Use **+ Shelf** to create collections; open a game's detail and tap the new shelf name to add membership.
- **+** adds a game to its platform shelf.
- Changes save locally using AsyncStorage. Uninstalling the app or clearing Expo Go storage may remove this data.

## Architecture
- `App.js` contains the first prototype UI, seeded games, state and interactions.
- `AsyncStorage` persists the game records, shelves, theme and sort mode.
- Each shelf stores a list of game IDs; a game can belong to multiple shelves without duplicate game records.

## Roadmap
1. Replace the long-press/tap-to-place workflow with true drag-and-drop.
2. Accurate artwork via licensed/user-supplied spines and cover uploads.
3. Rich game metadata, search and barcode entry.
4. Backup/sync, import/export, ownership condition, valuations.
5. Accessibility, performance and responsive layouts for large collections.
