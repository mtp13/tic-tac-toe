const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const DEFAULT_BRANCH = "master";

function readVercelConfig() {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, "vercel.json"), "utf8"),
  );
}

function ciPushBranches() {
  const ci = fs.readFileSync(
    path.join(repoRoot, ".github", "workflows", "ci.yml"),
    "utf8",
  );
  const branches = new Set();
  for (const match of ci.matchAll(/branches:\s*\[([^\]]*)\]/g)) {
    for (const part of match[1].split(",")) {
      const branch = part.trim();
      if (branch) branches.add(branch);
    }
  }
  for (const match of ci.matchAll(/^\s*-\s+(\S+)\s*$/gm)) {
    branches.add(match[1]);
  }
  return branches;
}

describe("vercel.json", () => {
  it("deploys the default branch and blocks the catch-all", () => {
    const enabled = readVercelConfig().git?.deploymentEnabled ?? {};
    assert.equal(
      enabled[DEFAULT_BRANCH],
      true,
      "the default branch must deploy, or production stops updating",
    );
    assert.equal(
      enabled["**"],
      false,
      "the catch-all rule must stay false, or branch previews eat the daily budget",
    );
  });

  it("CI runs on the default branch", () => {
    assert.ok(
      ciPushBranches().has(DEFAULT_BRANCH),
      "CI does not run on the default branch, so a merge records no CI run",
    );
  });
});
