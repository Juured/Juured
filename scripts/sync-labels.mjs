import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const labels = JSON.parse(readFileSync(".github/labels.json", "utf8"));

for (const label of labels) {
  const color = label.color.replace(/^#/, "");

  execFileSync(
    "gh",
    [
      "label",
      "create",
      label.name,
      "--color",
      color,
      "--description",
      label.description,
      "--force",
    ],
    {
      stdio: "inherit",
    },
  );
}

console.log(`Synchronized ${labels.length} labels.`);
