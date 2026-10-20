# AGENTS.md

Guidance for AI coding agents (Claude Code, Gemini CLI, Codex, etc.) working in
this repo. `CLAUDE.md` and `GEMINI.md` just import this file, so edit this one.

## Project

A Tic Tac Toe game for mobile and desktop, written in plain HTML, CSS and
JavaScript. It has a minimax AI with three difficulty levels and a 2-player
mode, and it can be installed as a PWA.

- **Dev dependencies for tooling are allowed, runtime dependencies are not, and
  there must never be a build step.** Don't add frameworks, runtime npm
  packages, a bundler or a build pipeline unless asked.
- The browser loads `app.js` directly as a classic `<script>`, not an ES module.

## Commands

```sh
npm test                                     # node --test tests/*.test.js (Node built-in test runner)
npm run test:e2e                             # playwright test (Desktop Chromium + Mobile WebKit E2E & axe a11y)
npm run format                               # prettier --write .
npm run lint                                 # prettier --check . && html-validate index.html
npm run lint:html                            # html-validate index.html
node --check app.js                          # syntax check (CI runs this too)
python3 -m http.server 4321 --bind 0.0.0.0   # serve locally & on LAN (port 4321 is open in UFW for mobile testing)
```

Serve the app over HTTP rather than opening it as `file://`, because the
manifest and PWA features need it. CI (`.github/workflows/ci.yml`) runs two jobs
on Node 22 for pull requests and pushes to `main` (superseded runs on the same
ref are cancelled): unit/lint checks (`npm ci`, `npm run lint`, syntax check,
`npm test`) and Playwright E2E/accessibility checks (`npm run test:e2e`).

## Layout

| File                                    | Purpose                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `index.html`                            | All markup. The 9 cells are static `<button class="cell" data-index="0-8">`.      |
| `app.js`                                | All game logic: state, AI, sound (Web Audio), persistence, confetti, event wiring |
| `sw.js`                                 | Service worker for offline play (precaches app shell, network-first fetch)        |
| `style.css`                             | Styles, organised in `@layer reset, base, theme, components, utilities`           |
| `reset.css`                             | The `reset` layer                                                                 |
| `manifest.webmanifest`                  | PWA manifest                                                                      |
| `favicon.png`, `icon-{180,192,512}.png` | Favicon (128×128), iOS touch icon (180×180 opaque RGB), and PWA/maskable icons    |
| `vercel.json`, `.vercelignore`          | Security/CSP and cache headers, plus deploy exclusion list                        |
| `tests/vercel.test.js`                  | Guards the `vercel.json` branch-deployment rule (only the default branch deploys) |
| `tests/game.test.js`                    | Unit tests plus DOM integration tests against a hand-rolled mock DOM              |
| `e2e/*.spec.js`, `playwright.config.js` | Real-browser Playwright E2E, offline, layout and axe accessibility tests          |
| `e2e/csp-fixture.js`                    | Playwright fixture that applies the `vercel.json` CSP to every HTML document      |

## How `app.js` works

- **It runs in both the browser and Node.** At the bottom, `initializeApp()`
  runs only if `document` exists, and `module.exports` is set only if `module`
  exists. Keep both guards. Don't use top-level `import`/`export`, and don't
  touch the DOM at the top level of the file.
- **DOM lookups belong in `bindDomElements()`.** Element references are `let`
  variables set there, which `initializeApp()` calls first. If you add an
  element, declare its variable at the top of the file and look it up in
  `bindDomElements()`, never at the top level.
- **Game state is module-level variables** (`board`, `currentPlayer`,
  `gameOver`, `scoresByMode`, `scores`, and so on). `scoresByMode` keeps
  separate score records for `onePlayer` and `twoPlayer` modes. Use
  `getGameState()` to read a snapshot in tests.
- **Moves:** `handleCellClick` checks the click is allowed, then calls
  `commitMove(index)`. In 1-player mode, `triggerComputerMove()` then schedules
  the AI's move with a `setTimeout`. `startNewRound()` must cancel that pending
  timeout and reset the round state.
- **AI:** the human is always X and the AI is always O. `minimax` (with
  alpha-beta pruning) treats X as the maximising player. `DIFFICULTY_STRENGTH`
  is the chance the AI plays its best move instead of a random one.
- **Persistence:** settings and per-mode scores are saved as one JSON blob under
  the `STORAGE_KEY` key in `localStorage`, and every access is wrapped in
  try/catch. Validate saved values when loading them. If the saved format
  changes incompatibly, bump the version suffix in the key.

## Conventions

- Prettier (`.prettierrc` + `.prettierignore`) is the source of truth for
  formatting (2 spaces, semicolons, double quotes). Run `npm run format` before
  committing. `.editorconfig` sets LF line endings and a final newline.
- Style the UI from state using `data-*` attributes and CSS `:has()`, for
  example `data-turn`, `data-game-over`, `data-mark`, and
  `body:has(#theme-checkbox:checked)` for the light theme. Don't toggle inline
  styles from JS.
- **No inline scripts, inline styles or third-party resources,** because they
  would break the Content Security Policy (`Content-Security-Policy` in
  `vercel.json`). If one is truly needed, update the CSP in `vercel.json` and
  document why.
- Keep CSS in the correct `@layer`. Reduced-motion overrides go in `utilities`,
  under `@media (prefers-reduced-motion: reduce)`.
- **Accessibility is required.** Cells keep `aria-label`s up to date through
  `getCellAriaLabel()`. The status banner is a live region. The arrow keys move
  around the board. Every control needs a visible `:focus-visible` style.
  Decorative SVGs get `aria-hidden="true"`.
- Mobile: account for safe-area insets (`env(safe-area-inset-*)`), `dvh` units,
  and the landscape layout for phones in `style.css`.

## Testing

- Unit tests (`npm test`) cover game logic, AI, persistence and static asset
  structure using only `node:test` and `node:assert/strict`. Playwright
  (`npm run test:e2e`) covers real-browser behaviour, layout, offline play and
  accessibility (`@axe-core/playwright`) in Desktop Chromium and Mobile WebKit.
  Run both before committing.
- **E2E specs must import `test` and `expect` from `./csp-fixture`, not from
  `@playwright/test`.** The local `python3 -m http.server` sends no headers, so
  the fixture reads the CSP from `vercel.json` and adds it to every same-origin
  HTML document. Without it the CSP-violation assertion can never fail. The
  fixture is shared with the other vanilla apps and has no game-specific code,
  so keep it identical to theirs.
- **Ports:** E2E uses 4311 (root) and 4312 (`/tic-tac-toe/` subfolder); the
  other apps use their own ports. 4321 is deliberately avoided because it is
  commonly held by a manual dev server for phone testing. `reuseExistingServer`
  is `false`, so a leftover server on either port makes `npm run test:e2e` fail
  instead of testing the wrong app. Stop your own server on 4311/4312 before
  running E2E, and don't kill processes you didn't start.
- The DOM unit tests use a mock in `setupMockDom()`. **If you add a
  `getElementById` or `querySelector` lookup to `app.js`, add it to the mock**
  or `initializeApp()` will crash in tests.
- The unit tests share `app.js`'s module state; `beforeEach` sets up a fresh
  mock DOM + `localStorage` and calls `initializeApp()` (which resets settings
  and calls `startNewRound()`), so tests must not rely on the order they run in.
- Add or update tests for any change to the game logic, the AI, persistence or
  UI. Run `npm run lint`, `npm test` and `npm run test:e2e` before you finish.

## Deployment

- The site is hosted on **Vercel** as a static site.
- Production is `https://mike.pullen.dev/tic-tac-toe/`, proxied from this Vercel
  project by the main site (`mtp13/mike.pullen.dev`). The
  `tic-tac-toe-mike-pullen.vercel.app` URL serves the app from `/`. Only `main`
  is deployed (`git.deploymentEnabled` in `vercel.json`), so feature branches
  and PRs get no Vercel preview (and no `Vercel` check on PRs, which is
  expected) because the Hobby plan caps deployments at 100/day. Test on
  localhost instead. The keys are minimatch patterns: keep `"**": false` (a bare
  `*` does not match branch names containing `/`, such as `feat/x`, so they
  would still deploy) and keep the explicit `"main": true` (Vercel deploys a
  branch if any matching rule is `true`, so `main` still deploys). This only
  blocks Git-triggered deployments: CLI `vercel` deploys and deploy hooks still
  count. `tests/vercel.test.js` guards this.
- All paths must stay relative. Never use root-anchored paths (`/…`) or a
  `<base>` tag.
- Playwright runs every test both at the root and in a `/tic-tac-toe/`
  subfolder.
- Headers and `.vercelignore` can only be checked with `curl` against production
  after merging, since branches are not deployed.
- `.vercelignore` excludes `package.json`, `package-lock.json`, tests, docs and
  tooling configs so Vercel deploys only the app's runtime files and skips
  `npm install`. `package.json` also has no `build` script, and no build script
  should be added.
- If you add a new tooling or config file, add it to `.vercelignore` so it isn't
  served. Never commit secrets.
- Paths in `index.html`, `manifest.webmanifest` and `sw.js` are relative (`./`,
  `favicon.png`, etc.) rather than root-anchored with `/` so the app works both
  at a domain root and in a subfolder. **If you add or rename an asset, update
  `index.html`, `manifest.webmanifest` and `PRECACHE_URLS` in `sw.js`.**
- Security headers (strict CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`) and cache rules (`max-age=0, must-revalidate` on
  `sw.js`, `index.html` and `manifest.webmanifest`) live in `vercel.json`. Don't
  put workarounds in `app.js`.

## Git & GitHub

- Commit locally as often as you like, but push once per unit of work: every
  push to `main` is a Vercel deployment and every PR push is a CI run. Don't
  push WIP commits, and batch review fixes into one push.
- The repo is on GitHub at `mtp13/tic-tac-toe` (remote `origin`), and `main` is
  the default branch.
- Before making changes, check the current branch. If you're on `main`, create a
  feature branch first (`feat/…`, `fix/…`, `chore/…`, `docs/…`). If you're
  already on a feature branch for related work, keep using it. Once a PR is
  merged, start new work on a fresh branch from an up-to-date `main`, and never
  push to a merged branch.
- When the work is finished, run `npm run format`, then `npm run lint`,
  `npm test` and `npm run test:e2e`. Commit only once all of them pass, then
  push the branch and open a pull request against `main` with `gh pr create`.
  Every commit must be formatted, not just the last one before a PR. Give the PR
  a summary and test notes. You don't need to ask first. If a PR is already open
  for the branch, push to update it.
- Use the `gh` CLI for PRs, issues and checking CI runs. Each PR runs CI through
  GitHub Actions; check it with `gh pr checks` and fix any failures.
- Never commit to, push to or force-push `main` directly.
