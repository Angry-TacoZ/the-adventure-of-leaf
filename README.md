# The Adventure of Leaf

An early Three.js / TypeScript / Vite river interaction prototype for thatgamejam #02. James Lane is the creative director; the scene and tuning are temporary.

## Run locally

Install Node.js 24, then run `npm ci --ignore-scripts` and `npm run dev`. Open the local address printed by Vite. Use WASD or arrows to direct wind, E to increase it, Q to decrease it, R to restart, and F for fullscreen. A standard-mapped gamepad uses the left stick and triggers. Wind intensity gradually returns toward natural conditions after release. The development-only tuning panel saves one preset in browser local storage.

Run `npm run verify` for simulation tests, TypeScript and a production build. With the dev server running and a Playwright Chromium browser installed, run `node tests/browser-check.mjs` for browser interactions and the WebGL failure message. `npm run preview` serves the built version.

See [design](docs/GAME_DESIGN.md), [architecture](docs/ARCHITECTURE.md), [water evaluation](docs/WATER_TECH_EVALUATION.md), and [known issues](docs/KNOWN_ISSUES.md). This is not a finished game. The jam requires a Windows or Mac build by November 7, 2026, 11:59 PM Pacific; browser development alone does not satisfy that requirement.
