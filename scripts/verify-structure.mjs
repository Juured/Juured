import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".cursor/rules/juured-agent-workflow.mdc",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  ".github/labeler.yml",
  ".github/labels.json",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/agent_task.yml",
  ".github/release.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/security.yml",
  ".github/workflows/pr-labeler.yml",
  ".github/workflows/labels.yml",
  ".github/workflows/release.yml",
  "docs/AGENT_WORKFLOW.md",
  "docs/ARCHITECTURE.md",
  "docs/CONTRIBUTOR_WORKFLOW.md",
  "docs/RELEASE_PROCESS.md",
  "docs/REPOSITORY_SETTINGS.md",
  "docs/SECURITY_CONTROLS.md",
  "docs/adr/0001-repository-foundation.md",
];

const missing = requiredFiles.filter((file) => !existsSync(file));

const workflowFiles = requiredFiles.filter((file) => file.startsWith(".github/workflows/"));
const workflowIssues = workflowFiles.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  const issues = [];

  if (!text.includes("permissions:")) {
    issues.push(`${file} must declare explicit permissions`);
  }

  if (text.includes("@main") || text.includes("@master")) {
    issues.push(`${file} must pin actions to version tags, not moving branches`);
  }

  return issues;
});

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scriptIssues = ["verify", "format:check", "lint:docs", "lint:spelling", "lint:structure"]
  .filter((script) => !packageJson.scripts?.[script])
  .map((script) => `package.json is missing scripts.${script}`);

const failures = [
  ...missing.map((file) => `Missing required file: ${relative(process.cwd(), file)}`),
  ...workflowIssues,
  ...scriptIssues,
];

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Repository structure verified (${requiredFiles.length} required files).`);
