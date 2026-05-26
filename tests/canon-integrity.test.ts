import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Deterministic post-condition for the architecture canon - the analog of
// `openspec validate --strict`, but for docs/architecture/. Promotion (the
// spec-driven-architecture `apply`) is an LLM-authored re-slice by scope, not a
// mechanical merge, so a dropped or mis-sliced section is caught here instead of in
// review. Contract: docs/architecture/canon.manifest.json. Narrated in
// docs/architecture/README.md ("Canon integrity"). Principle: verify, don't mechanize.

interface ManifestDoc {
  path: string;
  requiredSections?: string[];
  allowArchiveReference?: boolean;
}

interface Manifest {
  docs: ManifestDoc[];
  namedArtifacts: string[];
  forbidArchiveDependency: string[];
}

const ARCH_DIR = join(process.cwd(), "docs", "architecture");
const manifest = JSON.parse(
  readFileSync(join(ARCH_DIR, "canon.manifest.json"), "utf8"),
) as Manifest;

const canonDocs = manifest.docs.map((doc) => ({ ...doc, abs: resolve(ARCH_DIR, doc.path) }));

function read(abs: string): string {
  return readFileSync(abs, "utf8");
}

const FENCE = /^\s*```/;

// Visit each line outside a fenced code block (mermaid diagrams, ASCII art) so headings
// and links inside fences are never mistaken for real ones.
function eachProseLine(md: string, fn: (text: string, line: number) => void): void {
  let inFence = false;
  md.split(/\r?\n/).forEach((text, i) => {
    if (FENCE.test(text)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) {
      fn(text, i + 1);
    }
  });
}

// GitHub heading slug: lowercase, drop punctuation except word chars/space/hyphen,
// collapse runs of space into a single hyphen. Used to resolve intra-canon anchors.
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

// Identity for required-section / named-artifact matching: ignore a leading "N." number
// prefix so "## 4. Pipeline architecture" satisfies the required "Pipeline architecture".
function sectionKey(text: string): string {
  return text
    .trim()
    .replace(/^\d+[.)]\s*/, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

interface Heading {
  raw: string;
  line: number;
}

function headings(md: string): Heading[] {
  const out: Heading[] = [];
  eachProseLine(md, (text, line) => {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(text);
    if (match) {
      out.push({ raw: match[1], line });
    }
  });
  return out;
}

interface Link {
  target: string;
  line: number;
}

function linksOf(md: string): Link[] {
  const out: Link[] = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  eachProseLine(md, (text, line) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      out.push({ target: match[1].trim(), line });
    }
  });
  return out;
}

function firstLine(md: string, re: RegExp): number {
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      return i + 1;
    }
  }
  return -1;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns a description of why a link is broken, or null if it resolves. Anchors are
// checked against the in-doc headings (for `#...`) or the target .md file's headings.
function linkError(link: Link, abs: string, dir: string, selfHeadings: Heading[]): string | null {
  const { target, line } = link;
  if (/^(https?:|mailto:)/.test(target)) {
    return null;
  }
  if (target.startsWith("#")) {
    return selfHeadings.some((h) => slug(h.raw) === target.slice(1))
      ? null
      : `${abs}:${line} -> ${target} (no heading in this doc)`;
  }
  const [targetPath, anchor] = target.split("#");
  const targetAbs = resolve(dir, targetPath);
  if (!existsSync(targetAbs)) {
    return `${abs}:${line} -> ${target} (file not found)`;
  }
  if (
    anchor &&
    targetAbs.endsWith(".md") &&
    !headings(read(targetAbs)).some((h) => slug(h.raw) === anchor)
  ) {
    return `${abs}:${line} -> ${target} (no matching heading in target)`;
  }
  return null;
}

describe("canon integrity", () => {
  it("every manifest doc exists", () => {
    const missing = canonDocs.filter((doc) => !existsSync(doc.abs)).map((doc) => doc.path);
    expect(missing, `canon.manifest.json lists missing docs: ${missing.join(", ")}`).toEqual([]);
  });

  it.each(canonDocs)("$path keeps no leaked verification anchors", ({ abs }) => {
    // A leaked anchor is a raw HTML comment in the body. Skip fenced blocks (eachProseLine)
    // and strip inline code spans so prose that documents the `<!-- v:... -->` syntax in
    // backticks (this is what README does) is not mistaken for a real leak.
    let hit = -1;
    eachProseLine(read(abs), (text, line) => {
      if (hit === -1 && /<!--\s*v:/.test(text.replace(/`[^`]*`/g, ""))) {
        hit = line;
      }
    });
    expect(hit, `${abs}:${hit} still has a <!-- v:... --> anchor; promotion must strip them`).toBe(
      -1,
    );
  });

  it.each(canonDocs.filter((doc) => (doc.requiredSections?.length ?? 0) > 0))(
    "$path contains every required section",
    ({ abs, requiredSections }) => {
      const present = new Set(headings(read(abs)).map((h) => sectionKey(h.raw)));
      const missing = (requiredSections ?? []).filter((s) => !present.has(sectionKey(s)));
      expect(missing, `${abs} is missing required section(s): ${missing.join(", ")}`).toEqual([]);
    },
  );

  it("every named artifact resolves to a canon heading", () => {
    const headingKeys = new Set<string>();
    for (const { abs } of canonDocs) {
      for (const h of headings(read(abs))) {
        headingKeys.add(sectionKey(h.raw));
      }
    }
    const dangling: string[] = [];
    for (const artifact of manifest.namedArtifacts) {
      if (headingKeys.has(sectionKey(artifact))) {
        continue;
      }
      const phrase = new RegExp(`\\b${escapeRe(artifact)}\\b`, "i");
      for (const { abs } of canonDocs) {
        const line = firstLine(read(abs), phrase);
        if (line !== -1) {
          dangling.push(
            `${abs}:${line} references "${artifact}" but no canon doc has a matching heading`,
          );
          break;
        }
      }
    }
    expect(dangling, dangling.join("\n")).toEqual([]);
  });

  it.each(canonDocs.filter((doc) => !doc.allowArchiveReference))(
    "$path does not depend on the archive",
    ({ abs }) => {
      const md = read(abs);
      const hits: string[] = [];
      for (const pattern of manifest.forbidArchiveDependency) {
        const line = firstLine(md, new RegExp(escapeRe(pattern), "i"));
        if (line !== -1) {
          hits.push(`${abs}:${line} matches forbidden archive pattern "${pattern}"`);
        }
      }
      expect(hits, hits.join("\n")).toEqual([]);
    },
  );

  it.each(canonDocs)("$path has resolvable links and intra-canon anchors", ({ abs }) => {
    const md = read(abs);
    const dir = dirname(abs);
    const selfHeadings = headings(md);
    const broken = linksOf(md)
      .map((link) => linkError(link, abs, dir, selfHeadings))
      .filter((err): err is string => err !== null);
    expect(broken, `broken links/anchors:\n  ${broken.join("\n  ")}`).toEqual([]);
  });
});
