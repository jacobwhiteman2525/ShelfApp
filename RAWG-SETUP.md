# Live Game Discovery on Windows

ShelfVault v0.4 uses RAWG for Discover and on-demand metadata. Collection and Wishlist continue working without the proxy. The app stores those records under the same two AsyncStorage keys as before. RAWG links and metadata are additive, and only attach to older records after you select and confirm a match.

## Set up the proxy and Expo Go

1. Create a personal RAWG API key from the [RAWG API page](https://rawg.io/apidocs). Use Node.js 22 or newer. Run `npm ci` if this workspace does not yet have dependencies.
2. From the workspace, create an ignored file named `.env.proxy`. Put the API key only in this file. Generate a separate development token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

   ```dotenv
   RAWG_API_KEY=your_rawg_api_key
   RAWG_PROXY_TOKEN=your_random_dev_token
   RAWG_PROXY_HOST=0.0.0.0
   RAWG_PROXY_PORT=8787
   ```

3. On a trusted private Wi-Fi network shared by the PC and iPhone, use `ipconfig` to find the PC’s Wi-Fi IPv4 address. Create an ignored `.env.local` for Expo. Replace the example address and use the same development token.

   ```dotenv
   EXPO_PUBLIC_RAWG_PROXY_URL=http://192.168.1.50:8787
   EXPO_PUBLIC_RAWG_PROXY_TOKEN=your_random_dev_token
   ```

   Expo bundles these two public values. The development token is a local access gate visible to anyone with the bundle, so use a unique token for this workspace and keep the development bundle private. Never put the RAWG API key in `.env.local`, an `EXPO_PUBLIC_` variable, or the app config. The repository ignores `.env*`.

4. Run these in separate VS Code PowerShell terminals.

   ```powershell
   npm run proxy
   ```

   ```powershell
   npm start -- --lan
   ```

   Scan the Expo QR code with the iPhone. Allow Expo Go’s Local Network permission. If Windows Firewall blocks the proxy, allow TCP port 8787 on the private network only. Test the route by opening the proxy’s `/platforms` URL in Safari on the iPhone. An HTTP 401 response without credentials confirms the phone can reach the proxy. If Expo Go blocks plain HTTP or the network isolates devices, use the HTTPS option below.

5. To get the JavaScript bundle over a tunnel, run `npm run tunnel` instead of the LAN command. The Expo tunnel carries Metro traffic only. Keep the proxy’s LAN URL if the iPhone can reach it. For off-LAN testing, bind the proxy to `127.0.0.1` and use a separate private HTTPS tunnel that forwards to port 8787 and supports the app’s Authorization header. Set `EXPO_PUBLIC_RAWG_PROXY_URL` to that HTTPS address, then restart Expo and reload the app. Access policies vary by tunnel provider. Keep the development tunnel scoped to your devices.

## RAWG terms and hosting

The RAWG API page advertises 20,000 requests per month and requires an active RAWG link wherever its data or images appear. Its Free pricing card says non-commercial only, while the API terms describe a limited free commercial allowance. Use a personal development key here and confirm the applicable plan, licensing and limits with RAWG before release or commercial use. RAWG disclaims ownership of API images and prohibits redistribution of its data. ShelfVault labels the imagery as potentially promotional and keeps its browsing cache on the device. [RAWG API and pricing](https://rawg.io/apidocs) · [API terms](https://rawg.io/tos_api)

For deployment, a small Node service or container behind HTTPS can host the proxy. Store the RAWG key in the host’s secret manager, use real per-user authentication and rate limits, and monitor total monthly upstream calls against the account allowance. The included proxy is for local development. It restricts endpoints and parameters, applies a process-local concurrency and request limit, and forwards RAWG quota responses. It does not enforce the account’s monthly quota across clients or deployments.

## Verify in Expo Go

1. Open **Discover**. Check that the four sections load, attribution opens RAWG, and **Load More** appends results. Try each rating sort, and check that Upcoming only shows dated releases in the next 12 months. Missing scores should show as unavailable.
2. Type a title, change the platform filter, clear the search, and type rapidly. Only the current query’s results should appear. Check artwork and fallback on a result without an available image. Open a detail card and check the description, release date, developer, publisher, content rating, and separate Metacritic and RAWG scores wherever supplied.
3. Save a result with multiple available platforms. Verify that a platform choice is required, the tracked platform disappears from Discover, and other untracked platforms remain eligible. Remove it from Wishlist and check that it reappears. Save it again, move it to Collection, and check Wishlist removal and Collection deduplication.
4. Visit a query and detail online. Stop the proxy and revisit the same query and detail, then tap **Refresh** or **Retry** to check the connection state. A cached query can still be browsed. Unseen queries need a connection. Artwork is fetched separately and may show the placeholder offline. New Releases uses the past 365 days. Its cache key and Upcoming’s key include their date windows and can change after midnight.
5. Upgrade a device with existing games, wishlist entries, custom shelves, Notes, sorting, and a selected theme. Check those records after reopening the app. For an older game, tap **Find RAWG metadata**, inspect candidates, cancel one confirmation, then confirm the correct match. The saved title, platform label, Notes, and shelf membership should stay intact.
6. In a Collection detail, edit multiline Notes while the keyboard is open. Scroll and try a shelf control inside the card. Check the backdrop and **×** with clean and edited Notes. **Keep Editing** should retain the draft, **Discard** should retain the saved value, and **Save Notes** should survive reopening the detail. Check the existing Shelf, Grid and List views and manual spine rearrangement.

Run `npm test` for fixture-based tests. They use a loopback proxy with a fake upstream and need no RAWG key.

## Optional front covers

TheGamesDB exposes platform-specific front box art. Request API access through the link in [TheGamesDB’s developer footer](https://thegamesdb.net/), then add `THEGAMESDB_API_KEY=your_key` to the backend-only `.env.proxy`. Restart `npm run proxy`. Expo uses the existing proxy URL and development token. The artwork key belongs only on the backend. The provider has posted that new account registrations are temporarily disabled. Existing keys can be configured through the same flow. Confirm your key allowance and the rights for any artwork you plan to redistribute. [TheGamesDB registration](https://thegamesdb.net/register.php) · [API specification](https://api.thegamesdb.net/)

Opening a detail with a selected platform resolves front art on demand. Listings reuse these cached matches to limit provider requests. An ambiguous game match or unsupported platform falls back to the full RAWG background image in the portrait frame, then to a ShelfVault placeholder. IGDB also offers game covers, but its game-level cover is associated with a game that can have multiple platforms. TheGamesDB identifies front art on platform-specific records. The lookup does not verify region, printing, edition, or physical release. [IGDB API](https://api-docs.igdb.com/)

## Discover content filtering

Ordinary browsing and search exclude identifiable explicit sexual games. The proxy checks provider tags and genres, compound rating signals, and narrowly scoped title or description signals. ESRB Mature and Adults Only alone are insufficient to classify a game as explicitly sexual. RAWG sometimes omits tags or descriptions from a list item. A detail that later reveals explicit content is closed and removed from safe results, but unclassified games can slip through when source metadata is missing or misleading. [RAWG response schema](https://api.rawg.io/docs/)

For an intentional lookup, type a title and tap **Search exact title**, or search a clearly explicit category such as `hentai games`. Exact-title mode returns matches to that title and resets when the search text changes. There is no global setting. Explicit matches are labeled. Safe, exact, and explicit-category pages use separate cache entries. Each load checks up to three provider pages when filtering leaves few results. Collection and Wishlist records remain outside the Discover policy.

On iPhone, open a long-title game and a game with a short description. Check that the title wraps beside the artwork, the X stays reachable, and short descriptions have no expansion control. Open a game with a long description, expand and collapse it, and open a different game to check the default. Verify front art with a configured provider, a full landscape fallback, a missing-art placeholder, and an older saved game in Collection Grid or List. Check Discover tabs, platform filters, pagination and offline browsing with both safe and exact searches. Verify a mature mainstream result remains searchable and existing Collection or Wishlist entries are still present.
