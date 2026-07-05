import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluatePullRequest } from "../src/rules.js";
import { formatReport } from "../src/reporters.js";
import { buildPullRequestComment, initPolicyFiles, parseArgs } from "../src/cli.js";

const risky = {
  title: "Improve auth and billing",
  body: "This PR updates auth files and modifies billing code.",
  files: [
    { filename: "src/auth/session.ts", additions: 200, deletions: 50 },
    { filename: "src/billing/checkout.ts", additions: 300, deletions: 100 },
  ],
};

const riskyReport = evaluatePullRequest(risky, { maxChangedLines: 200 });
assert.equal(riskyReport.recommendation, "needs-maintainer-triage");
assert.equal(riskyReport.findings.some((finding) => finding.id === "intake.linked-issue"), true);
assert.equal(riskyReport.findings.some((finding) => finding.id === "risk.sensitive-paths"), true);
assert.equal(riskyReport.findings.some((finding) => finding.id === "quality.missing-tests"), true);
assert.deepEqual(riskyReport.suggestedLabels, [
  "needs-context",
  "large-pr",
  "sensitive-paths",
  "missing-tests",
]);

const clean = {
  title: "Fix docs typo",
  body:
    "Fixes #12. This updates documentation only and explains the exact typo corrected. No runtime code changes are included, and no tests are required because the change is documentation-only.",
  files: [{ filename: "docs/configuration.md", additions: 1, deletions: 1 }],
};

const cleanReport = evaluatePullRequest(clean);
assert.equal(cleanReport.recommendation, "ready-for-review");
assert.equal(cleanReport.findingCount, 0);
assert.deepEqual(cleanReport.suggestedLabels, []);

const conciseDocsPr = {
  title: "Fix README typo",
  body: "Fixes #18. Corrects a README typo.",
  files: [{ filename: "README.md", additions: 1, deletions: 1 }],
};
const conciseDocsReport = evaluatePullRequest(conciseDocsPr);
assert.equal(conciseDocsReport.findingCount, 0);

const vagueCodePr = {
  title: "Update auth logic",
  body: "Fixes #19. Updates code.",
  files: [{ filename: "src/auth/session.ts", additions: 20, deletions: 4 }],
};
const vagueCodeReport = evaluatePullRequest(vagueCodePr);
assert.equal(
  vagueCodeReport.findings.some((finding) => finding.id === "intake.weak-description"),
  true,
);

const disclosureReport = evaluatePullRequest(clean, { requireAiDisclosure: true });
assert.equal(disclosureReport.findings.some((finding) => finding.id === "policy.ai-disclosure"), true);
assert.equal(disclosureReport.suggestedLabels.includes("ai-disclosure"), true);

assert.match(formatReport(riskyReport, "table"), /Maintainer Gate/);
assert.match(formatReport(riskyReport, "table"), /Suggested labels: `needs-context`/);
assert.match(formatReport(riskyReport, "markdown"), /Review Checklist/);
assert.match(formatReport(riskyReport, "markdown"), /Suggested labels: `needs-context`/);
assert.doesNotThrow(() => JSON.parse(formatReport(riskyReport, "json")));
assert.deepEqual(JSON.parse(formatReport(riskyReport, "json")).suggestedLabels, riskyReport.suggestedLabels);
assert.match(buildPullRequestComment(riskyReport), /<!-- maintainer-gate-report -->/);
assert.match(buildPullRequestComment(riskyReport), /Maintainer Gate Report/);

assert.equal(parseArgs(["--input", "pr.json", "--format", "json"]).format, "json");
assert.equal(parseArgs(["policy", "init"]).command, "policy-init");
assert.equal(parseArgs(["policy", "init", "--force"]).force, true);
assert.throws(() => parseArgs(["--format", "xml"]), /format must be/);

const originalCwd = process.cwd();
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "maintainer-gate-policy-"));
try {
  process.chdir(tempDir);
  const initResult = await initPolicyFiles();
  assert.deepEqual(initResult.files, [
    ".maintainer-gate.json",
    "AI_POLICY.md",
    path.join(".github", "PULL_REQUEST_TEMPLATE.md"),
  ]);
  const policy = JSON.parse(await fs.readFile(".maintainer-gate.json", "utf8"));
  assert.equal(policy.requireLinkedIssue, true);
  assert.equal(policy.maxChangedLines, 600);
  assert.match(await fs.readFile("AI_POLICY.md", "utf8"), /AI Contribution Policy/);
  assert.match(
    await fs.readFile(path.join(".github", "PULL_REQUEST_TEMPLATE.md"), "utf8"),
    /AI Assistance/,
  );

  await fs.writeFile("AI_POLICY.md", "keep me", "utf8");
  await assert.rejects(() => initPolicyFiles(), /would overwrite existing file/);
  assert.equal(await fs.readFile("AI_POLICY.md", "utf8"), "keep me");

  await initPolicyFiles({ force: true });
  assert.match(await fs.readFile("AI_POLICY.md", "utf8"), /AI Contribution Policy/);
} finally {
  process.chdir(originalCwd);
  await fs.rm(tempDir, { recursive: true, force: true });
}

console.log("All tests passed.");
