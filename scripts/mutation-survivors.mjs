// Turn Stryker's JSON report into an agent-queryable survivor list.
//
// A raw mutation report is a dashboard; a coding agent needs the actionable subset:
// which mutants the suite FAILED to catch (Survived) and which code was never run at
// all (NoCoverage), with file:line, the mutation applied, and the original code. Those
// are exactly the assertion gaps to close. Run after `npm run test:mutation`.
//
// Usage: node scripts/mutation-survivors.mjs
import { readFile } from "node:fs/promises";

const REPORT = "reports/mutation/mutation.json";

const report = await readFile(REPORT, "utf8").catch(() => {
  console.error(`No report at ${REPORT}. Run \`npm run test:mutation\` first.`);
  process.exit(1);
});

const { files } = JSON.parse(report);
const counts = {};
const gaps = [];

for (const [path, file] of Object.entries(files)) {
  const lines = file.source.split("\n");
  for (const m of file.mutants) {
    counts[m.status] = (counts[m.status] ?? 0) + 1;
    // Survived = test ran but did not assert the change. NoCoverage = never executed.
    // Both are real gaps; everything else (Killed/Timeout/errors) is the suite working.
    if (m.status !== "Survived" && m.status !== "NoCoverage") continue;
    const line = m.location.start.line;
    gaps.push({
      path,
      line,
      status: m.status,
      mutator: m.mutatorName,
      original: (lines[line - 1] ?? "").trim(),
      replacement: m.replacement,
    });
  }
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
const killed = counts.Killed ?? 0;
const timeout = counts.Timeout ?? 0;
// Mutation score = detected / (all mutants that ran, excluding ignored/no-coverage),
// the same definition Stryker prints.
const denom = total - (counts.NoCoverage ?? 0) - (counts.Ignored ?? 0);
const score = denom > 0 ? (((killed + timeout) / denom) * 100).toFixed(1) : "n/a";

console.log(`Mutation score: ${score}%  (${killed + timeout}/${denom} detected)`);
console.log(`Status breakdown:`, counts);

if (gaps.length === 0) {
  console.log("\nNo survivors. Every mutant in scope was caught.");
  process.exit(0);
}

console.log(`\n${gaps.length} assertion gap(s) - mutants the suite did not catch:\n`);
gaps.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
for (const g of gaps) {
  console.log(`  ${g.path}:${g.line}  [${g.status}] ${g.mutator}`);
  console.log(`    is:      ${g.original}`);
  console.log(`    mutated: ${g.replacement}`);
}
