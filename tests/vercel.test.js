const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("vercel.json", () => {
  it("deploys only main (branch names with / need **, not *)", () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"),
    );
    assert.deepEqual(config.git?.deploymentEnabled, {
      main: true,
      "**": false,
    });
  });
});
