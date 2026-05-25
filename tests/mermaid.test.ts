// @vitest-environment jsdom
//
// Validates every ```mermaid block in the canon against Mermaid's OWN parser
// (mermaid.parse), so a diagram that will not render is caught here, not on the
// published page. We use the official engine, not a third-party validator: the
// dedicated validators either crash (mermaid-validate) or reimplement the grammar
// and throw false positives on valid Mermaid (@probelabs/maid). See
// docs/verification-gate.md (Stage 0 - the gate references this check).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false });

const ROOTS = ["docs", "openspec/changes"];

function markdownFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true }) as string[])
    .filter((p) => /\.(md|markdown|mdx)$/i.test(p))
    .map((p) => join(root, p))
    .filter((p) => !p.includes("archive")); // archived changes are frozen history
}

type Block = { id: string; code: string };

const blocks: Block[] = ROOTS.flatMap(markdownFiles).flatMap((file) => {
  const md = readFileSync(file, "utf8");
  const found: Block[] = [];
  for (const m of md.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)) {
    const line = md.slice(0, m.index ?? 0).split("\n").length;
    found.push({ id: `${file}:${line}`, code: m[1] });
  }
  return found;
});

describe("mermaid diagrams parse with the official engine", () => {
  it("finds mermaid blocks to validate", () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it.each(blocks.map((b) => [b.id, b.code] as const))("%s renders", async (_id, code) => {
    await expect(mermaid.parse(code)).resolves.toBeTruthy();
  });
});
