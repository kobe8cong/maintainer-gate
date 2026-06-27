import fs from "node:fs/promises";
import path from "node:path";
import { evaluatePullRequest, mergePolicy } from "./rules.js";
import { formatReport } from "./reporters.js";

export async function runCli(argv) {
  const options = parseArgs(argv);
  if (options.version) {
    process.stdout.write("0.1.2\n");
    return;
  }
  if (options.help) {
    process.stdout.write(helpText());
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
    help: false,
    version: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
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
  return options;
}

async function loadInput(inputPath) {
  const resolved = inputPath ?? process.env.GITHUB_EVENT_PATH;
  if (!resolved) {
    throw new Error("provide --input <file> or run inside GitHub Actions with GITHUB_EVENT_PATH");
  }
  return JSON.parse(await fs.readFile(path.resolve(process.cwd(), resolved), "utf8"));
}

async function enrichInput(input) {
  if (!input.pull_request || input.files?.length || input.pull_request.files?.length) {
    return input;
  }
  const token = process.env.GITHUB_TOKEN ?? envInput("token");
  const repository = process.env.GITHUB_REPOSITORY;
  const number = input.pull_request.number;
  if (!token || !repository || !number || typeof fetch !== "function") {
    return input;
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}/pulls/${number}/files?per_page=100`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    },
  );
  if (!response.ok) return input;
  return { ...input, files: await response.json() };
}

async function upsertPullRequestComment(input, report) {
  const token = process.env.GITHUB_TOKEN ?? envInput("token");
  const repository = process.env.GITHUB_REPOSITORY;
  const number = input.pull_request?.number ?? input.number;
  if (!token || !repository || !number || typeof fetch !== "function") return;

  const body = buildPullRequestComment(report);
  const baseUrl = `https://api.github.com/repos/${repository}/issues/${number}/comments`;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
  };

  const commentsResponse = await fetch(`${baseUrl}?per_page=100`, { headers });
  if (!commentsResponse.ok) return;
  const comments = await commentsResponse.json();
  const existing = comments.find((comment) => comment.body?.includes(marker));
  if (existing) {
    await fetch(existing.url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body }),
    });
    return;
  }

  await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ body }),
  });
}

export function buildPullRequestComment(report) {
  const marker = "<!-- maintainer-gate-report -->";
  return `${marker}\n${formatReport(report, "markdown")}`;
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

Examples:
  maintainer-gate --input examples/risky-pr.json
  maintainer-gate --input pr.json --format markdown
  maintainer-gate --input pr.json --require-ai-disclosure
  maintainer-gate --input pr.json --max-files 12 --max-lines 400

Options:
  --config <file>              Read policy from .maintainer-gate.json.
  --fail-on <severity>         Exit non-zero when findings meet severity.
  --format <format>            table, markdown, or json.
  --input <file>               Pull request event or normalized PR JSON.
  --max-files <count>          Maximum changed files before large-PR finding.
  --max-lines <count>          Maximum changed lines before large-PR finding.
  --no-config                  Ignore .maintainer-gate.json.
  --no-linked-issue            Do not require a linked issue.
  --require-ai-disclosure      Require an AI assistance disclosure.
  --version                    Print the current version.
`;
}
