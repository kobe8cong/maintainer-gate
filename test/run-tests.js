import assert from "node:assert/strict";
import { evaluatePullRequest } from "../src/rules.js";
import { formatReport } from "../src/reporters.js";
import { buildPullRequestComment, parseArgs } from "../src/cli.js";

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

const clean = {
  title: "Fix docs typo",
  body:
    "Fixes #12. This updates documentation only and explains the exact typo corrected. No runtime code changes are included, and no tests are required because the change is documentation-only.",
  files: [{ filename: "docs/configuration.md", additions: 1, deletions: 1 }],
};

const cleanReport = evaluatePullRequest(clean);
assert.equal(cleanReport.recommendation, "ready-for-review");
assert.equal(cleanReport.findingCount, 0);

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

assert.match(formatReport(riskyReport, "table"), /Maintainer Gate/);
assert.match(formatReport(riskyReport, "markdown"), /Review Checklist/);
assert.doesNotThrow(() => JSON.parse(formatReport(riskyReport, "json")));
assert.match(buildPullRequestComment(riskyReport), /<!-- maintainer-gate-report -->/);
assert.match(buildPullRequestComment(riskyReport), /Maintainer Gate Report/);

assert.equal(parseArgs(["--input", "pr.json", "--format", "json"]).format, "json");
assert.throws(() => parseArgs(["--format", "xml"]), /format must be/);

console.log("All tests passed.");
