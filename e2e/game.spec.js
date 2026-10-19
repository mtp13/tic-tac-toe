const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active && reg.active.state === "activated") return;
    await new Promise((resolve) => {
      const sw = reg.installing || reg.waiting || reg.active;
      if (!sw || sw.state === "activated") {
        resolve();
        return;
      }
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") resolve();
      });
    });
  });
}

test.describe("Tic Tac Toe E2E & Accessibility", () => {
  let consoleErrors = [];
  let pageErrors = [];
  let cspViolations = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    cspViolations = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        window.__cspViolations.push(
          `${e.violatedDirective}: ${e.blockedURI || "inline"}`,
        );
      });
    });
  });

  test.afterEach(async ({ page }) => {
    const violations = await page
      .evaluate(() => window.__cspViolations || [])
      .catch(() => []);
    cspViolations.push(...violations);

    expect(consoleErrors, "Expected zero console.error messages").toEqual([]);
    expect(pageErrors, "Expected zero uncaught page errors").toEqual([]);
    expect(cspViolations, "Expected zero CSP violations").toEqual([]);
  });

  test("1-player game on Unbeatable: game ends and X never wins", async ({
    page,
  }) => {
    await page.goto("./");

    // Select Unbeatable difficulty
    await page.locator('input[name="difficulty"][value="hard"]').check({
      force: true,
    });

    const board = page.locator("#board");
    const status = page.locator("#status");

    for (let turn = 0; turn < 9; turn++) {
      const isGameOver = await board.getAttribute("data-game-over");
      if (isGameOver === "true") break;

      await expect(board).toHaveAttribute("data-turn", "X");

      // Click the first empty cell
      const emptyCell = page
        .locator(".cell:not([data-mark]):not([disabled])")
        .first();
      await emptyCell.click();

      // Wait until either the game ends or the AI finishes its move and turn returns to X
      await expect
        .poll(async () => {
          const over = await board.getAttribute("data-game-over");
          const currentTurn = await board.getAttribute("data-turn");
          return over === "true" || currentTurn === "X";
        })
        .toBe(true);
    }

    await expect(board).toHaveAttribute("data-game-over", "true");
    await expect(status).not.toContainText("You win");
    await expect(page.locator("#score-x")).toHaveText("0");
  });

  test("2-player game to an X win: checks status, winning cells, win line, score, and alternating starter", async ({
    page,
  }) => {
    await page.goto("./");

    await page.locator('input[name="gameMode"][value="twoPlayer"]').check({
      force: true,
    });
    await expect(page.locator("#status")).toHaveText("Player X's turn");

    const cells = page.locator(".cell");
    await cells.nth(0).click();
    await expect(page.locator("#status")).toHaveText("Player O's turn");
    await cells.nth(3).click();
    await cells.nth(1).click();
    await cells.nth(4).click();
    await cells.nth(2).click();

    await expect(page.locator("#status")).toHaveText("Player X wins! 🎉");
    await expect(page.locator("#score-x")).toHaveText("1");
    await expect(cells.nth(0)).toHaveClass(/highlight/);
    await expect(cells.nth(1)).toHaveClass(/highlight/);
    await expect(cells.nth(2)).toHaveClass(/highlight/);
    await expect(page.locator("#win-line-svg")).toHaveClass(/visible/);
    await expect(page.locator("#win-line-svg")).toHaveAttribute(
      "data-winner",
      "X",
    );

    // New Round alternates starter to Player O
    await page.locator("#new-game-button").click();
    await expect(page.locator("#board")).toHaveAttribute("data-turn", "O");
    await expect(page.locator("#status")).toHaveText("Player O's turn");
  });

  test("keyboard play: arrow keys and Enter/Space place marks", async ({
    page,
  }) => {
    await page.goto("./");

    await page.locator('input[name="gameMode"][value="twoPlayer"]').check({
      force: true,
    });

    const cells = page.locator(".cell");
    await cells.nth(0).focus();
    await expect(cells.nth(0)).toBeFocused();

    // Place X at cell 0 with Enter
    await page.keyboard.press("Enter");
    await expect(cells.nth(0)).toHaveAttribute("data-mark", "X");

    // Navigate right -> down to center cell (index 4) and place O with Space
    await page.keyboard.press("ArrowRight");
    await expect(cells.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(cells.nth(4)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(cells.nth(4)).toHaveAttribute("data-mark", "O");
  });

  test("settings: 2-player mode disables difficulty and each mode keeps its own scores", async ({
    page,
  }) => {
    await page.goto("./");

    const diffFieldset = page.locator("#difficulty-fieldset");
    const diffRadios = page.locator('input[name="difficulty"]');
    await expect(diffFieldset).toHaveJSProperty("disabled", false);
    await expect(diffRadios.first()).toBeEnabled();

    // Switch to 2-player mode
    await page.locator('input[name="gameMode"][value="twoPlayer"]').check({
      force: true,
    });
    await expect(diffFieldset).toHaveJSProperty("disabled", true);
    for (let i = 0; i < 3; i++) {
      await expect(diffRadios.nth(i)).toBeDisabled();
    }

    // Win a game in 2-player mode
    const cells = page.locator(".cell");
    for (const idx of [0, 3, 1, 4, 2]) {
      await cells.nth(idx).click();
    }
    await expect(page.locator("#score-x")).toHaveText("1");

    // Switch back to 1-player mode: difficulty enabled and 1P score is 0
    await page.locator('input[name="gameMode"][value="onePlayer"]').check({
      force: true,
    });
    await expect(diffFieldset).toHaveJSProperty("disabled", false);
    await expect(diffRadios.first()).toBeEnabled();
    await expect(page.locator("#score-x")).toHaveText("0");

    // Switch to 2-player mode again: 2P score of 1 is kept
    await page.locator('input[name="gameMode"][value="twoPlayer"]').check({
      force: true,
    });
    await expect(page.locator("#score-x")).toHaveText("1");
  });

  test("persistence: scores, theme, mode, and difficulty survive reload", async ({
    page,
  }) => {
    await page.goto("./");

    // Change difficulty to hard, theme to light, and mode to 2-player
    await page.locator('input[name="difficulty"][value="hard"]').check({
      force: true,
    });
    await page.locator("#theme-checkbox").check({ force: true });
    await page.locator('input[name="gameMode"][value="twoPlayer"]').check({
      force: true,
    });

    // Win a 2-player game
    const cells = page.locator(".cell");
    for (const idx of [0, 3, 1, 4, 2]) {
      await cells.nth(idx).click();
    }
    await expect(page.locator("#score-x")).toHaveText("1");

    await page.reload();

    await expect(
      page.locator('input[name="gameMode"][value="twoPlayer"]'),
    ).toBeChecked();
    await expect(
      page.locator('input[name="difficulty"][value="hard"]'),
    ).toBeChecked();
    await expect(page.locator("#theme-checkbox")).toBeChecked();
    await expect(page.locator("#score-x")).toHaveText("1");
    await expect(page.locator("#difficulty-fieldset")).toHaveJSProperty(
      "disabled",
      true,
    );
    await expect(
      page.locator('input[name="difficulty"]').first(),
    ).toBeDisabled();
  });

  test("theme: toggling theme updates theme-color meta tag and background color", async ({
    page,
  }) => {
    await page.goto("./");

    const themeMeta = page.locator("#theme-color-meta");
    const themeCheckbox = page.locator("#theme-checkbox");

    // Ensure dark mode first
    if (await themeCheckbox.isChecked()) {
      await themeCheckbox.uncheck({ force: true });
    }
    await expect(themeMeta).toHaveAttribute("content", "#091326");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(9, 19, 38)",
    );

    // Toggle to light theme
    await themeCheckbox.check({ force: true });
    await expect(themeMeta).toHaveAttribute("content", "#eef5fc");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(238, 245, 252)",
    );
  });

  test("layout: no horizontal scroll and whole board visible at iPhone portrait and landscape sizes", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 390, height: 844 }, // iPhone portrait
      { width: 844, height: 390 }, // Phone landscape
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("./");

      const layoutMetrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const board = document.getElementById("board").getBoundingClientRect();
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          boardTop: board.top,
          boardLeft: board.left,
          boardRight: board.right,
          boardBottom: board.bottom,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        };
      });

      expect(layoutMetrics.scrollWidth).toBeLessThanOrEqual(
        layoutMetrics.clientWidth,
      );
      expect(layoutMetrics.boardTop).toBeGreaterThanOrEqual(0);
      expect(layoutMetrics.boardLeft).toBeGreaterThanOrEqual(0);
      expect(layoutMetrics.boardRight).toBeLessThanOrEqual(
        layoutMetrics.innerWidth,
      );
      expect(layoutMetrics.boardBottom).toBeLessThanOrEqual(
        layoutMetrics.innerHeight,
      );
    }
  });

  test("offline: service worker activates, page reloads offline, and moves work", async ({
    page,
    context,
  }) => {
    await page.goto("./");

    // Wait for service worker to be registered and active
    await waitForServiceWorker(page);

    await context.setOffline(true);
    try {
      await page.reload();
      await page.locator(".cell").nth(0).click();
      await expect(page.locator(".cell").nth(0)).toHaveAttribute(
        "data-mark",
        "X",
      );
    } finally {
      await context.setOffline(false);
    }
  });

  test("offline: uncached navigation falls back to the cached app shell", async ({
    page,
    context,
  }) => {
    await page.goto("./");
    await waitForServiceWorker(page);

    await context.setOffline(true);
    try {
      // This URL was never cached, so the service worker's fallback must serve it.
      await page.goto("./?source=pwa");
      await expect(page.locator(".cell")).toHaveCount(9);
      await page.locator(".cell").nth(0).click();
      await expect(page.locator(".cell").nth(0)).toHaveAttribute(
        "data-mark",
        "X",
      );
    } finally {
      await context.setOffline(false);
    }
  });

  test("accessibility: axe finds no wcag2a/wcag2aa violations in dark theme, light theme, and game-over state", async ({
    page,
  }) => {
    await page.goto("./");

    const themeCheckbox = page.locator("#theme-checkbox");
    if (await themeCheckbox.isChecked()) {
      await themeCheckbox.uncheck({ force: true });
    }

    // 1. Dark theme
    const darkScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(darkScan.violations).toEqual([]);

    // 2. Light theme
    await themeCheckbox.check({ force: true });
    const lightScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(lightScan.violations).toEqual([]);

    // 3. Game-over state
    await page.locator('input[name="gameMode"][value="twoPlayer"]').check({
      force: true,
    });
    const cells = page.locator(".cell");
    for (const idx of [0, 3, 1, 4, 2]) {
      await cells.nth(idx).click();
    }
    await expect(page.locator("#board")).toHaveAttribute(
      "data-game-over",
      "true",
    );

    const gameOverScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(gameOverScan.violations).toEqual([]);
  });
});
