import fs from "node:fs/promises";
import path from "node:path";
import { defaultPolicy, evaluatePullRequest, mergePolicy } from "./rules.js";
import { formatReport } from "./reporters.js";

const commentMarker = "<!-- maintainer-gate-report -->";

export async function runCli(argv) {
  const options = parseArgs(argv);
  if (options.version) {
    process.stdout.write("0.1.4\n");
    return;
  }
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }
  if (options.command === "policy-init") {
    const result = await initPolicyFiles({ force: options.force });
    process.stdout.write(`${result.message}\n`);
    return;
  }

  const config = options.noConfig ? {} : await loadJsonIfExists(options.configPath);
  const policy = mergePolicy({ ...config, ...options.policyOverrides });
  const input = await enrichInput(await loadInput(options.inputPath));
  const report = evaluatePullRequest(input, policy);
  const output = formatReport(report, options.format);
  process.stdout.write(output);
  if (options.format !== "json") process.stdout.write("\n");
  if (process.env.GITHUB_STEP_SUMMARY && options.format === "markdown") {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, output);
  }
  if (shouldComment()) {
    await upsertPullRequestComment(input, report);
  }

  const failOn = options.failOn ?? policy.failOn;
  if (failOn && shouldFail(report, failOn)) {
    process.exit(1);
  }
}

export function parseArgs(argv) {
  const options = {
    inputPath: null,
    configPath: ".maintainer-gate.json",
    format: envInput("format") ?? "table",
    failOn: envInput("fail-on") ?? null,
    noConfig: false,
    policyOverrides: {},
    command: null,
    force: false,
    help: false,
    version: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "policy" && argv[index + 1] === "init") {
      options.command = "policy-init";
      index += 1;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--input") {
      options.inputPath = argv[++index] ?? null;
    } else if (arg === "--config") {
      options.configPath = argv[++index] ?? options.configPath;
    } else if (arg === "--no-config") {
      options.noConfig = true;
    } else if (arg === "--format") {
      options.format = argv[++index] ?? options.format;
    } else if (arg === "--fail-on") {
      options.failOn = argv[++index] ?? "high";
    } else if (arg === "--require-ai-disclosure") {
      options.policyOverrides.requireAiDisclosure = true;
    } else if (arg === "--no-linked-issue") {
      options.policyOverrides.requireLinkedIssue = false;
    } else if (arg === "--max-files") {
      options.policyOverrides.maxChangedFiles = Number(argv[++index]);
    } else if (arg === "--max-lines") {
      options.policyOverrides.maxChangedLines = Number(argv[++index]);
    } else if (arg === "--version" || arg === "-v") {
      options.version = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!["table", "markdown", "json"].includes(options.format)) {
    throw new Error("format must be one of: table, markdown, json");
  }
  if (options.failOn && !["low", "medium", "high", "critical"].includes(options.failOn)) {
    throw new Error("fail-on must be one of: low, medium, high, critical");
  }
  if (options.force && options.command !== "policy-init") {
    throw new Error("--force is only supported with policy init");
  }
  return options;
}

export async function initPolicyFiles({ force = false } = {}) {
  const files = policyInitFiles();
  if (!force) {
    const existing = [];
    for (const file of files) {
      if (await fileExists(file.path)) existing.push(file.path);
    }
    if (existing.length > 0) {
      throw new Error(
        `policy init would overwrite existing file(s): ${existing.join(", ")}. Re-run with --force to replace them.`,
      );
    }
  }

  for (const file of files) {
    await fs.mkdir(path.dirname(file.path), { recursive: true });
    await fs.writeFile(file.path, file.content, "utf8");
  }

  return {
    files: files.map((file) => file.path),
    message: `Created ${files.map((file) => file.path).join(", ")}`,
  };
}

function policyInitFiles() {
  return [
    {
      path: ".maintainer-gate.json",
      content: `${JSON.stringify(defaultPolicy, null, 2)}\n`,
    },
    {
      path: "AI_POLICY.md",
      content: aiPolicyTemplate(),
    },
    {
      path: path.join(".github", "PULL_REQUEST_TEMPLATE.md"),
      content: pullRequestTemplate(),
    },
  ];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function loadInput(inputPath) {
  const resolved = inputPath ?? process.env.GITHUB_EVENT_PATH;
  if (!resolved) {
    throw new Error("provide --input <file> or run inside GitHub Actions with GITHUB_EVENT_PATH");
  }
  return JSON.parse(await fs.readFile(path.resolve(process.cwd(), resolved), "utf8"));
}

export async function enrichInput(input) {
  if (!input.pull_request || input.files?.length || input.pull_request.files?.length) {
    return input;
  }
  const token = process.env.GITHUB_TOKEN ?? envInput("token");
  const repository = process.env.GITHUB_REPOSITORY;
  const number = input.pull_request.number;
  if (!token || !repository || !number || typeof fetch !== "function") {
    return input;
  }

  const files = await fetchPaginated(
    `https://api.github.com/repos/${repository}/pulls/${number}/files?per_page=100`,
    githubHeaders(token),
    "fetch pull request files",
  );
  return { ...input, files };
}

export async function upsertPullRequestComment(input, report) {
  const token = process.env.GITHUB_TOKEN ?? envInput("token");
  const repository = process.env.GITHUB_REPOSITORY;
  const number = input.pull_request?.number ?? input.number;
  if (!token || !repository || !number || typeof fetch !== "function") return;

  const body = buildPullRequestComment(report);
  const baseUrl = `https://api.github.com/repos/${repository}/issues/${number}/comments`;
  const headers = githubHeaders(token, true);

  const comments = await fetchPaginated(
    `${baseUrl}?per_page=100`,
    headers,
    "list pull request comments",
  );
  const existing = comments.find((comment) => comment.body?.includes(commentMarker));
  if (existing) {
    await fetchChecked(existing.url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body }),
    }, "update pull request comment");
    return;
  }

  await fetchChecked(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ body }),
  }, "create pull request comment");
}

export function buildPullRequestComment(report) {
  return `${commentMarker}\n${formatReport(report, "markdown")}`;
}

async function fetchPaginated(url, headers, operation) {
  const items = [];
  let nextUrl = url;
  while (nextUrl) {
    const response = await fetchChecked(nextUrl, { headers }, operation);
    const page = await response.json();
    if (!Array.isArray(page)) {
      throw new Error(`GitHub API returned an invalid response while trying to ${operation}`);
    }
    items.push(...page);
    nextUrl = nextLink(response.headers?.get?.("link"));
  }
  return items;
}

async function fetchChecked(url, options, operation) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`GitHub API failed to ${operation}: ${error.message}`, { cause: error });
  }
  if (!response.ok) {
    const detail = [response.status, response.statusText].filter(Boolean).join(" ");
    throw new Error(`GitHub API failed to ${operation}${detail ? ` (${detail})` : ""}`);
  }
  return response;
}

function nextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const entry of linkHeader.split(",")) {
    const match = entry.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

function githubHeaders(token, includeContentType = false) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    ...(includeContentType ? { "content-type": "application/json" } : {}),
    "x-github-api-version": "2022-11-28",
  };
}

async function loadJsonIfExists(configPath) {
  try {
    return JSON.parse(await fs.readFile(path.resolve(process.cwd(), configPath), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(`could not read config ${configPath}: ${error.message}`);
  }
}

function shouldFail(report, level) {
  const order = ["low", "medium", "high", "critical"];
  const threshold = order.indexOf(level);
  return order.some((severity, index) => index >= threshold && report.counts[severity] > 0);
}

function shouldComment() {
  return ["1", "true", "yes"].includes(String(envInput("comment") ?? "").toLowerCase());
}

function envInput(name) {
  const normalized = name.toUpperCase().replaceAll("-", "_");
  return process.env[`INPUT_${normalized}`] ?? process.env[`INPUT_${name.toUpperCase()}`] ?? null;
}

function helpText() {
  return `maintainer-gate

Usage:
  maintainer-gate --input pr.json [--format table|markdown|json] [--fail-on high]
  maintainer-gate policy init [--force]

Examples:
  maintainer-gate --input examples/risky-pr.json
  maintainer-gate --input pr.json --format markdown
  maintainer-gate --input pr.json --require-ai-disclosure
  maintainer-gate --input pr.json --max-files 12 --max-lines 400
  maintainer-gate policy init

Options:
  --config <file>              Read policy from .maintainer-gate.json.
  --fail-on <severity>         Exit non-zero when findings meet severity.
  --format <format>            table, markdown, or json.
  --force                      Replace existing policy init files.
  --input <file>               Pull request event or normalized PR JSON.
  --max-files <count>          Maximum changed files before large-PR finding.
  --max-lines <count>          Maximum changed lines before large-PR finding.
  --no-config                  Ignore .maintainer-gate.json.
  --no-linked-issue            Do not require a linked issue.
  --require-ai-disclosure      Require an AI assistance disclosure.
  --version                    Print the current version.
`;
}

function aiPolicyTemplate() {
  return `# AI Contribution Policy

This project accepts AI-assisted contributions when contributors remain accountable for the work.

## Contributor Expectations

- Understand the change you submit.
- Link the issue or explain the problem before opening a large pull request.
- Keep pull requests small and focused.
- Disclose meaningful AI assistance in the pull request body when requested.
- Run tests and explain any missing test coverage.
- Do not resubmit maintainer feedback through an AI tool without understanding the result.

## Disclosure Example

\`\`\`markdown
AI assistance: Used Codex to draft tests after I wrote the implementation. I reviewed and edited the generated code before submitting.
\`\`\`

Maintainers may ask for more context, request smaller changes, require tests, or close low-context pull requests without deep review.
`;
}

function pullRequestTemplate() {
  return `## Summary


## Linked Issue

Fixes #

## Testing


## AI Assistance

Disclose meaningful AI assistance, or write "None".

`;
}
