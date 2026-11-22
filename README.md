# ShelfVault v0.4.0

ShelfVault is an Expo and React Native app for cataloging physical games on iPhone. Collection has spine-based shelves plus Grid and List views. Wishlist tracks games you want, and Discover uses RAWG for live search, platform filters, release lists, and ratings.

## Set up on Windows

### 1. Install and open the project

- Use Node.js **22.13 or later in the 22.x series**, VS Code, and a version of Expo Go that supports **Expo SDK 58** on your iPhone.
- Open this project folder in VS Code. Run these commands in its terminal.

```powershell
node --version
npm ci
```

If PowerShell blocks npm scripts, use `npm.cmd` and `npx.cmd` in PowerShell, or use a Command Prompt terminal.

### 2. Configure the local proxy

Get a personal RAWG API key from the [RAWG API page](https://rawg.io/apidocs). Generate a separate development token with this command.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Create `.env.proxy` in the project root, or update the existing file. Replace the example key and token with your own values.

```dotenv
RAWG_API_KEY=your_rawg_api_key
RAWG_PROXY_TOKEN=your_generated_development_token
RAWG_PROXY_HOST=0.0.0.0
RAWG_PROXY_PORT=8787
```

For optional physical front covers, add `THEGAMESDB_API_KEY=your_thegamesdb_api_key` to the same file. The app shows a ShelfVault placeholder when no verified cover is available. RAWG promotional images are stored separately. See the [provider setup and limits](RAWG-SETUP.md#optional-front-covers).

### 3. Point Expo Go at the proxy

Connect the PC and iPhone to the same trusted Wi-Fi network. Run `ipconfig` and find the IPv4 address of the PC’s active network adapter. In the project root, create or update `.env.local`. Replace `192.168.1.50` with that address and use the same development token as above.

```dotenv
EXPO_PUBLIC_RAWG_PROXY_URL=http://192.168.1.50:8787
EXPO_PUBLIC_RAWG_PROXY_TOKEN=your_generated_development_token
```

The Expo bundle includes these two public settings. Keep the RAWG and TheGamesDB API keys exclusively in the backend’s `.env.proxy`. Git ignores `.env*` files.

### 4. Run both services

In one VS Code terminal, start the proxy.

```powershell
npm run proxy
```

In a second terminal, start Expo.

```powershell
npm start -- --lan
```

Keep both terminals running. Scan the Expo QR code with the iPhone Camera, open it in Expo Go, and allow Local Network access. Open **Discover** to verify the live connection.

## Troubleshoot Expo Go

- **Could not reach the proxy.** Check `ipconfig` for a changed IP address and update `.env.local`. If the proxy is bound to a specific old IP, update `RAWG_PROXY_HOST` too. Restart the proxy and restart Expo with `npm start -- --lan --clear`, then reload on iPhone.
- **Check whether the phone reaches Windows.** Open `http://YOUR_PC_IP:8787/platforms` in iPhone Safari. **Proxy access denied** (HTTP 401) is expected without the token and confirms the phone reached the proxy. If Safari times out, check the Wi-Fi and Windows Firewall’s Private profile for port 8787.
- **Using Expo tunnel.** Run `npm run tunnel` in place of the Expo LAN command. It tunnels Metro only. Off-LAN access to the proxy needs a separate private HTTPS route. See the [full connection guide and PowerShell diagnostics](RAWG-SETUP.md#diagnose-the-local-connection).

## Use and verify the app

- **Collection** supports Wood and Modern themes, custom shelves, and Manual, A–Z, and Z–A sorting. In Shelf view, long-press a spine, then tap a target spine or **+ End** to place it.
- Open a game to see its details. Collection also offers personal Notes and shelf membership. Older Collection and Wishlist entries look up a title and platform match when opened. Ambiguous matches require confirmation.
- **Discover** offers Popular, New Releases, Upcoming, and Top Rated, with cached browsing and manual entry. Collection and Wishlist are saved locally and remain available when the proxy is offline. Clearing Expo Go’s storage can remove local saves.

```powershell
npm test
npx expo install --check
```

See the [Expo Go verification checklist](RAWG-SETUP.md#verify-in-expo-go) for device checks.
