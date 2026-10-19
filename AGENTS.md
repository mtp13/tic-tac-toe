# AGENTS.md

Guidance for AI coding agents (Claude Code, Gemini CLI, Codex, etc.) working in this repo.
`CLAUDE.md` and `GEMINI.md` just import this file, so edit this one.

## Project

A Tic Tac Toe game for mobile and desktop, written in plain HTML, CSS and JavaScript. It has a minimax AI with three difficulty levels and a 2-player mode, and it can be installed as a PWA.

- **There are no dependencies, no bundler and no build step.** Don't add frameworks, npm packages or a build pipeline unless asked.
- The browser loads `app.js` directly as a classic `<script>`, not an ES module.

## Commands

```sh
node --test tests/*.test.js                  # run test suite directly with Node's built-in runner (or `npm test`)
node --check app.js                          # syntax check (CI runs this too)
python3 -m http.server 4321 --bind 0.0.0.0   # serve locally & on LAN (port 4321 is open in UFW for mobile testing)
```

Serve the app over HTTP rather than opening it as `file://`, because the manifest and PWA features need it.
CI (`.github/workflows/ci.yml`) runs the syntax check and the tests on Node 22 for pull requests and for pushes to `main`.

## Layout

| File                                    | Purpose                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `index.html`                            | All markup. The 9 cells are static `<button class="cell" data-index="0-8">`.      |
| `app.js`                                | All game logic: state, AI, sound (Web Audio), persistence, confetti, event wiring |
| `style.css`                             | Styles, organised in `@layer reset, base, theme, components, utilities`           |
| `reset.css`                             | The `reset` layer                                                                 |
| `manifest.webmanifest`                  | PWA manifest                                                                      |
| `favicon.png`, `icon-{180,192,512}.png` | Favicon (128×128), iOS touch icon (180×180 opaque RGB), and PWA/maskable icons    |
| `tests/game.test.js`                    | Unit tests plus DOM integration tests against a hand-rolled mock DOM              |

## How `app.js` works

- **It runs in both the browser and Node.** At the bottom, `initializeApp()` runs only if `document` exists, and `module.exports` is set only if `module` exists. Keep both guards. Don't use top-level `import`/`export`, and don't touch the DOM at the top level of the file.
- **DOM lookups belong in `bindDomElements()`.** Element references are `let` variables set there, which `initializeApp()` calls first. If you add an element, declare its variable at the top of the file and look it up in `bindDomElements()`, never at the top level.
- **Game state is module-level variables** (`board`, `currentPlayer`, `gameOver`, `scoresByMode`, `scores`, and so on). `scoresByMode` keeps separate score records for `onePlayer` and `twoPlayer` modes. Use `getGameState()` to read a snapshot in tests.
- **Moves:** `handleCellClick` checks the click is allowed, then calls `commitMove(index)`. In 1-player mode, `triggerComputerMove()` then schedules the AI's move with a `setTimeout`. `startNewRound()` must cancel that pending timeout and reset the round state.
- **AI:** the human is always X and the AI is always O. `minimax` (with alpha-beta pruning) treats X as the maximising player. `DIFFICULTY_STRENGTH` is the chance the AI plays its best move instead of a random one.
- **Persistence:** settings and per-mode scores are saved as one JSON blob under the `STORAGE_KEY` key in `localStorage`, and every access is wrapped in try/catch. Validate saved values when loading them. If the saved format changes incompatibly, bump the version suffix in the key.

## Conventions

- Prettier: 2 spaces, semicolons, double quotes. `.editorconfig` sets LF line endings and a final newline.
- Style the UI from state using `data-*` attributes and CSS `:has()`, for example `data-turn`, `data-game-over`, `data-mark`, and `body:has(#theme-checkbox:checked)` for the light theme. Don't toggle inline styles from JS.
- Keep CSS in the correct `@layer`. Reduced-motion overrides go in `utilities`, under `@media (prefers-reduced-motion: reduce)`.
- **Accessibility is required.** Cells keep `aria-label`s up to date through `getCellAriaLabel()`. The status banner is a live region. The arrow keys move around the board. Every control needs a visible `:focus-visible` style. Decorative SVGs get `aria-hidden="true"`.
- Mobile: account for safe-area insets (`env(safe-area-inset-*)`), `dvh` units, and the landscape layout for phones in `style.css`.

## Testing

- Use only `node:test` and `node:assert/strict`, with no test libraries.
- The DOM tests use a mock in `setupMockDom()`. **If you add a `getElementById` or `querySelector` lookup to `app.js`, add it to the mock** or `initializeApp()` will crash in tests.
- The tests share `app.js`'s module state; `beforeEach` sets up a fresh mock DOM + `localStorage` and calls `initializeApp()` (which resets settings and calls `startNewRound()`), so tests must not rely on the order they run in.
- Add or update tests for any change to the game logic, the AI or persistence. Run `node --test tests/*.test.js` (or `npm test`) before you finish.

## Deployment

- The site is hosted on **Vercel** as a static site. The repo root is served as-is: `index.html` is at `/` and every other file is at its own path.
- There's no `vercel.json` and no build step. `package.json` has no `build` script, which keeps Vercel from running a build. Don't add one unless the deployment needs it.
- Everything in the repo is publicly accessible, including `tests/` and `AGENTS.md`. Never commit secrets. Add a `.vercelignore` if a file shouldn't be served.
- Paths in `index.html` and `manifest.webmanifest` are relative (`./`, `favicon.png`, etc.) rather than root-anchored with `/` so the app works both at a domain root and in a subfolder. If you add or rename an asset, check those references.
- If you need headers, redirects or caching rules, add a `vercel.json`. Don't put workarounds in `app.js`.

## Git & GitHub

- The repo is on GitHub at `mtp13/tic-tac-toe` (remote `origin`), and `main` is the default branch.
- Before making changes, check the current branch. If you're on `main`, create a feature
  branch first (`feat/…`, `fix/…`, `chore/…`, `docs/…`). If you're already on a feature
  branch for related work, keep using it.
- When the work is finished and tests pass, commit it, push the branch and open a
  pull request against `main` with `gh pr create`. Give the PR a summary and test notes.
  You don't need to ask first. If a PR is already open for the branch, push to update it.
- Use the `gh` CLI for PRs, issues and checking CI runs. Each PR runs CI through GitHub
  Actions; check it with `gh pr checks` and fix any failures.
- Never commit to, push to or force-push `main` directly.
