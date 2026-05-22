import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// Enforces the one-way spec -> architecture link convention (see
// docs/architecture/README.md). The "## Architecture" section is OPTIONAL; when a
// spec has one, every local link inside it must resolve to a real file on disk.
// This is the "link, don't sync" guard: it checks that the pointer exists, never
// that the linked content agrees - that stays human review.

const SPECS_DIR = join(process.cwd(), "openspec", "specs");

function listSpecFiles(): string[] {
  if (!existsSync(SPECS_DIR)) return [];
  return readdirSync(SPECS_DIR)
    .map((name) => join(SPECS_DIR, name, "spec.md"))
    .filter((p) => existsSync(p));
}

function architectureSection(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Architecture\s*$/.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

function localLinkTargets(section: string): string[] {
  const targets: string[] = [];
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(section)) !== null) {
    const target = match[1].trim().split("#")[0].split("?")[0];
    if (target.length === 0) continue;
    if (/^(https?:|mailto:)/.test(target)) continue; // external, not our concern
    targets.push(target);
  }
  return targets;
}

const specFiles = listSpecFiles();

describe("spec -> architecture references", () => {
  it("checks the canonical specs that exist (an empty set is allowed)", () => {
    // openspec/specs may be absent or empty when no capability has been promoted
    // yet - that is not a violation, there is simply nothing to link. The per-spec
    // checks below run for each spec that does exist.
    expect(specFiles.every((file) => existsSync(file))).toBe(true);
  });

  it.each(specFiles)("%s architecture links all resolve", (specFile) => {
    const section = architectureSection(readFileSync(specFile, "utf8"));
    if (section === null) return; // section is optional - nothing to validate
    const broken = localLinkTargets(section).filter(
      (target) => !existsSync(resolve(dirname(specFile), target)),
    );
    expect(
      broken,
      `${specFile} has broken architecture links:\n  ${broken.join("\n  ")}`,
    ).toEqual([]);
  });
});
