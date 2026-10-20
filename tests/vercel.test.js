const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");

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
  it("deploys only master (branch names with / need **, not *)", () => {
    assert.deepEqual(readVercelConfig().git?.deploymentEnabled, {
      master: true,
      "**": false,
    });
  });

  it("deploys the branch that CI runs on", () => {
    const config = readVercelConfig();
    const deployed = Object.entries(config.git?.deploymentEnabled ?? {})
      .filter(([, enabled]) => enabled)
      .map(([branch]) => branch);
    const ciBranches = ciPushBranches();
    for (const branch of deployed) {
      assert.ok(
        ciBranches.has(branch),
        `CI does not run on ${branch}, so it would never be deployed`,
      );
    }
  });
});
