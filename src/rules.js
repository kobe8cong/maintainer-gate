export const severityWeight = {
  critical: 10,
  high: 6,
  medium: 3,
  low: 1,
};

const severityLevels = Object.keys(severityWeight);

export const defaultPolicy = {
  requireLinkedIssue: true,
  requireAiDisclosure: false,
  maxChangedFiles: 18,
  maxChangedLines: 600,
  riskyPathSeverity: "high",
  minBodyLength: 120,
  failOn: "high",
  riskyPathGroups: [
    {
      name: "auth",
      patterns: ["auth", "oauth", "session", "permission", "rbac", "login"],
    },
    {
      name: "security",
      patterns: ["security", "crypto", "secret", "token", "password", "csrf", "cors"],
    },
    {
      name: "billing",
      patterns: ["billing", "payment", "stripe", "invoice", "checkout", "price"],
    },
    {
      name: "database",
      patterns: ["migration", "schema", "database", "prisma", "typeorm", "sequelize"],
    },
    {
      name: "release",
      patterns: [".github/workflows", "deploy", "release", "dockerfile", "terraform"],
    },
  ],
};

export const findingLabels = {
  "intake.linked-issue": "needs-context",
  "intake.weak-description": "needs-context",
  "intake.large-pr": "large-pr",
  "risk.sensitive-paths": "sensitive-paths",
  "quality.missing-tests": "missing-tests",
  "quality.missing-docs": "missing-docs",
  "policy.ai-disclosure": "ai-disclosure",
};

export function evaluatePullRequest(input, policy = {}) {
  const mergedPolicy = mergePolicy(policy);
  const normalized = normalizePullRequest(input);
  const findings = [
    linkedIssueRule(normalized, mergedPolicy),
    aiDisclosureRule(normalized, mergedPolicy),
    descriptionQualityRule(normalized, mergedPolicy),
    sizeRule(normalized, mergedPolicy),
    riskyPathsRule(normalized, mergedPolicy),
    missingTestsRule(normalized),
    missingDocsRule(normalized),
  ].filter(Boolean);

  return summarize(normalized, mergedPolicy, findings);
}

export function mergePolicy(policy = {}) {
  const merged = {
    ...defaultPolicy,
    ...policy,
    riskyPathGroups: policy.riskyPathGroups ?? defaultPolicy.riskyPathGroups,
  };
  validatePolicy(merged);
  return merged;
}

export function validatePolicy(policy) {
  for (const field of ["requireLinkedIssue", "requireAiDisclosure"]) {
    if (typeof policy[field] !== "boolean") {
      throw new Error(`policy.${field} must be a boolean`);
    }
  }

  for (const field of ["maxChangedFiles", "maxChangedLines", "minBodyLength"]) {
    if (!Number.isInteger(policy[field]) || policy[field] < 0) {
      throw new Error(`policy.${field} must be a non-negative integer`);
    }
  }

  for (const field of ["riskyPathSeverity", "failOn"]) {
    if (!severityLevels.includes(policy[field])) {
      throw new Error(`policy.${field} must be one of: ${severityLevels.join(", ")}`);
    }
  }

  if (!Array.isArray(policy.riskyPathGroups)) {
    throw new Error("policy.riskyPathGroups must be an array");
  }
  for (const [index, group] of policy.riskyPathGroups.entries()) {
    if (!group || typeof group.name !== "string" || group.name.trim() === "") {
      throw new Error(`policy.riskyPathGroups[${index}].name must be a non-empty string`);
    }
    if (
      !Array.isArray(group.patterns) ||
      group.patterns.length === 0 ||
      group.patterns.some((pattern) => typeof pattern !== "string" || pattern.trim() === "")
    ) {
      throw new Error(
        `policy.riskyPathGroups[${index}].patterns must contain non-empty strings`,
      );
    }
  }
}

function normalizePullRequest(input) {
  const pr = input.pull_request ?? input;
  const files = normalizeFiles(input.files ?? pr.files ?? []);
  const title = String(pr.title ?? input.title ?? "");
  const body = String(pr.body ?? input.body ?? "");
  return {
    title,
    body,
    author: pr.user?.login ?? input.author ?? "",
    number: pr.number ?? input.number ?? null,
    files,
    changedFiles: Number(pr.changed_files ?? input.changedFiles ?? files.length),
    additions: Number(pr.additions ?? input.additions ?? sum(files, "additions")),
    deletions: Number(pr.deletions ?? input.deletions ?? sum(files, "deletions")),
  };
}

function normalizeFiles(files) {
  return files.map((file) => {
    if (typeof file === "string") {
      return { filename: file, additions: 0, deletions: 0, status: "modified" };
    }
    return {
      filename: String(file.filename ?? file.path ?? ""),
      additions: Number(file.additions ?? 0),
      deletions: Number(file.deletions ?? 0),
      status: String(file.status ?? "modified"),
    };
  });
}

function linkedIssueRule(pr, policy) {
  if (!policy.requireLinkedIssue) return null;
  if (hasLinkedIssue(pr)) return null;
  return finding({
    id: "intake.linked-issue",
    severity: "medium",
    title: "No linked issue or clear issue reference",
    message:
      "Ask for a linked issue or a short problem statement before spending review time.",
    evidence: "No issue keyword or GitHub issue URL was found in the title or body.",
    checklist: "Confirm the problem is accepted before reviewing implementation details.",
  });
}

function aiDisclosureRule(pr, policy) {
  if (!policy.requireAiDisclosure) return null;
  const hasDisclosure = /\b(AI-assisted|AI assisted|Generated-by|Assisted-by|LLM|Claude|Codex|Copilot|ChatGPT)\b/i.test(
    pr.body,
  );
  if (hasDisclosure) return null;
  return finding({
    id: "policy.ai-disclosure",
    severity: "medium",
    title: "AI assistance disclosure missing",
    message:
      "The project policy requires contributors to disclose meaningful AI assistance.",
    evidence: "No AI assistance disclosure marker was found in the PR body.",
    checklist: "Ask the contributor to update the PR body with the tools and scope used.",
  });
}

function descriptionQualityRule(pr, policy) {
  const body = pr.body.trim();
  if (isLowRiskContextPr(pr, body)) return null;
  if (body.length >= policy.minBodyLength && !looksLikeDiffNarration(body)) return null;
  return finding({
    id: "intake.weak-description",
    severity: "medium",
    title: "Weak PR description",
    message:
      "The description may not give maintainers enough intent, testing, or tradeoff context.",
    evidence: body ? truncate(body) : "PR body is empty.",
    checklist: "Ask for intent, user impact, tests run, and known risks before deep review.",
  });
}

function sizeRule(pr, policy) {
  const changedLines = pr.additions + pr.deletions;
  if (pr.changedFiles <= policy.maxChangedFiles && changedLines <= policy.maxChangedLines) {
    return null;
  }
  return finding({
    id: "intake.large-pr",
    severity: "high",
    title: "Large PR needs triage before review",
    message:
      "Large unsolicited PRs are expensive to review and should be split or justified.",
    evidence: `${pr.changedFiles} files changed, ${changedLines} changed lines.`,
    checklist: "Ask whether this can be split into smaller, issue-linked changes.",
  });
}

function riskyPathsRule(pr, policy) {
  const matches = [];
  for (const file of pr.files) {
    const filename = file.filename.toLowerCase();
    for (const group of policy.riskyPathGroups) {
      if (group.patterns.some((pattern) => filename.includes(pattern.toLowerCase()))) {
        matches.push(`${file.filename} (${group.name})`);
        break;
      }
    }
  }
  if (matches.length === 0) return null;
  return finding({
    id: "risk.sensitive-paths",
    severity: policy.riskyPathSeverity,
    title: "Sensitive paths changed",
    message:
      "The PR touches areas where maintainers usually want extra context, tests, or owner review.",
    evidence: matches.slice(0, 8).join(", "),
    checklist: "Route to an owner for auth, security, billing, database, or release review.",
  });
}

function missingTestsRule(pr) {
  if (hasOnlyDocs(pr.files) || hasTestChanges(pr.files)) return null;
  const productionChanges = pr.files.some((file) => isProductionCode(file.filename));
  if (!productionChanges) return null;
  return finding({
    id: "quality.missing-tests",
    severity: "medium",
    title: "Production code changed without tests",
    message:
      "Maintainers should know whether the behavior is covered before reviewing implementation details.",
    evidence: "No test file changes were detected.",
    checklist: "Ask for tests or an explicit reason tests are not applicable.",
  });
}

function missingDocsRule(pr) {
  const hasUserFacingConfig = pr.files.some((file) =>
    /(action\.ya?ml|package\.json|cli|config|policy|workflow)/i.test(file.filename),
  );
  if (!hasUserFacingConfig || hasDocsChanges(pr.files)) return null;
  return finding({
    id: "quality.missing-docs",
    severity: "low",
    title: "User-facing behavior may need docs",
    message:
      "The PR changes configuration, policy, or CLI surface without a visible docs update.",
    evidence: "No README, docs, or policy file changes were detected.",
    checklist: "Check whether README, docs, or examples need to be updated.",
  });
}

function summarize(pr, policy, findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  let riskScore = 0;
  for (const item of findings) {
    counts[item.severity] += 1;
    riskScore += severityWeight[item.severity];
  }
  const readiness = Math.max(0, Math.round(100 - Math.min(100, riskScore * 6)));
  const recommendation = recommendationFor(counts);
  return {
    tool: "maintainer-gate",
    version: "0.1.4",
    recommendation,
    readiness,
    policy: {
      requireLinkedIssue: policy.requireLinkedIssue,
      requireAiDisclosure: policy.requireAiDisclosure,
      maxChangedFiles: policy.maxChangedFiles,
      maxChangedLines: policy.maxChangedLines,
      failOn: policy.failOn,
    },
    pullRequest: {
      number: pr.number,
      title: pr.title,
      author: pr.author,
      changedFiles: pr.changedFiles,
      additions: pr.additions,
      deletions: pr.deletions,
    },
    counts,
    findingCount: findings.length,
    suggestedLabels: suggestedLabelsFor(findings),
    findings,
    checklist: findings.map((item) => item.checklist),
  };
}

function suggestedLabelsFor(findings) {
  return [...new Set(findings.map((item) => findingLabels[item.id]).filter(Boolean))];
}

function recommendationFor(counts) {
  if (counts.critical > 0) return "block";
  if (counts.high > 0) return "needs-maintainer-triage";
  if (counts.medium > 0) return "request-context";
  if (counts.low > 0) return "review-with-notes";
  return "ready-for-review";
}

function finding({ id, severity, title, message, evidence, checklist }) {
  return { id, severity, title, message, evidence, checklist };
}

function hasLinkedIssue(pr) {
  const text = `${pr.title}\n${pr.body}`;
  return (
    /\b(close[sd]?|fix(e[sd])?|resolve[sd]?|refs?|related to)\s+#\d+\b/i.test(text) ||
    /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/i.test(text)
  );
}

function isLowRiskContextPr(pr, body) {
  if (!body || !hasLinkedIssue(pr)) return false;
  if (!hasOnlyDocs(pr.files)) return false;
  if (pr.changedFiles > 3) return false;
  if (pr.additions + pr.deletions > 80) return false;
  return /\b(docs?|documentation|typo|readme|changelog|spelling|copy|comment)\b/i.test(
    `${pr.title}\n${body}`,
  );
}

function hasTestChanges(files) {
  return files.some((file) => /(^|\/)(__tests__|tests?|spec|fixtures)(\/|$)|\.(test|spec)\./i.test(file.filename));
}

function hasDocsChanges(files) {
  return files.some((file) => /(^|\/)(docs?|README|CHANGELOG|CONTRIBUTING|AI_POLICY|SECURITY)/i.test(file.filename));
}

function hasOnlyDocs(files) {
  return files.length > 0 && files.every((file) => hasDocsChanges([file]) || /\.(md|mdx|txt)$/i.test(file.filename));
}

function isProductionCode(filename) {
  return /\.(js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|cs|php|swift|kt|kts)$/i.test(filename);
}

function looksLikeDiffNarration(body) {
  const lines = body.split(/\r?\n/).filter(Boolean);
  const genericLines = lines.filter((line) =>
    /\b(updated|modified|changed|added|removed|refactored)\b.{0,80}\b(file|function|component|code|logic)\b/i.test(
      line,
    ),
  );
  return lines.length > 0 && genericLines.length / lines.length > 0.6;
}

function truncate(text, length = 180) {
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function sum(files, field) {
  return files.reduce((total, file) => total + Number(file[field] ?? 0), 0);
}
