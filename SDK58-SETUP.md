# ShelfVault SDK 58 update

Expo Go on iPhone requires SDK 58. This project now requests Expo SDK 58.

On Windows 10 with Node.js installed:

1. Extract the ZIP into a fresh folder.
2. Open that folder in VS Code, then Terminal > New Terminal.
3. Run `npm install`.
4. Run `npx expo install --fix` to synchronize React Native, React, and other native dependencies with SDK 58.
5. Run `npx expo-doctor` to inspect compatibility; resolve any reported dependency issues.
6. Run `npx expo start -c`.
7. Scan the new QR code using iPhone Camera to open in Expo Go.

If Windows PowerShell blocks npm scripts, use Command Prompt as the VS Code terminal.
If Wi-Fi networking fails, stop Expo and run `npx expo start --tunnel -c`.

Note: SDK 58 dependency compatibility and runtime have not been tested in this environment.
