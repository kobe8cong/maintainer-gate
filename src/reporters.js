export function formatReport(report, format) {
  if (format === "json") return `${JSON.stringify(report, null, 2)}\n`;
  if (format === "markdown") return markdown(report);
  return table(report);
}

function table(report) {
  const lines = [
    `Maintainer Gate: ${report.recommendation}`,
    `Readiness: ${report.readiness}/100`,
    `PR: ${report.pullRequest.title || "(untitled)"}`,
    `Changed: ${report.pullRequest.changedFiles} files, ${report.pullRequest.additions} additions, ${report.pullRequest.deletions} deletions`,
    `Critical ${report.counts.critical} | High ${report.counts.high} | Medium ${report.counts.medium} | Low ${report.counts.low}`,
  ];

  if (report.findings.length === 0) {
    lines.push("No intake blockers found by the current policy.");
    return lines.join("\n");
  }

  lines.push("");
  for (const finding of report.findings) {
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.title}`);
    lines.push(`  ${finding.message}`);
    lines.push(`  Evidence: ${finding.evidence}`);
    lines.push(`  Checklist: ${finding.checklist}`);
  }
  return lines.join("\n");
}

function markdown(report) {
  const lines = [
    "# Maintainer Gate Report",
    "",
    `Recommendation: **${report.recommendation}**`,
    "",
    `Readiness: **${report.readiness}/100**`,
    "",
    `Changed: **${report.pullRequest.changedFiles}** files, **${report.pullRequest.additions}** additions, **${report.pullRequest.deletions}** deletions.`,
    "",
    "| Severity | Count |",
    "| --- | ---: |",
    `| Critical | ${report.counts.critical} |`,
    `| High | ${report.counts.high} |`,
    `| Medium | ${report.counts.medium} |`,
    `| Low | ${report.counts.low} |`,
    "",
  ];

  if (report.findings.length === 0) {
    lines.push("No intake blockers found by the current policy.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Findings", "");
  for (const finding of report.findings) {
    lines.push(
      `### ${finding.severity.toUpperCase()}: ${finding.title}`,
      "",
      finding.message,
      "",
      `- Rule: \`${finding.id}\``,
      `- Evidence: ${finding.evidence}`,
      `- Maintainer checklist: ${finding.checklist}`,
      "",
    );
  }

  lines.push("## Review Checklist", "");
  for (const item of report.checklist) {
    lines.push(`- [ ] ${item}`);
  }
  return `${lines.join("\n")}\n`;
}
