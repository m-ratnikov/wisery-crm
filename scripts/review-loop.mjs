// Deterministic loop control for the per-change review loop (docs/process/engineering.md).
//
// The loop's exit condition ("archive only once a pass finds nothing material") was
// pure convention: nothing counted rounds or checked the exit was earned, and
// LLM-judged exits fail toward a premature "done" (provenance:
// docs/explore/2026-07-02-review-loop-determinism.md). This script makes the exit
// mechanical:
//
//   record <change> --verdict clean|findings   append a review round + code-tree hash
//   check  <change>                            pass iff the last round is clean AND the tree is unchanged
//   gate                                       Claude Code PreToolUse hook: block `openspec archive`
//                                              unless check passes for the archived change
//
// The tree hash is content-addressed (tracked + untracked file contents), so a commit
// does not invalidate a review but any code edit does - an unreviewed fix delta can
// never reach archive. docs/, openspec/, and .claude/ are excluded: a code review's
// subject is code, and recording the round itself must not invalidate the round.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const EXCLUDED = /^(docs|openspec|\.claude)\//;
const VERDICTS = new Set(["clean", "findings"]);
// Escalation threshold - the loop's max-iterations. The stop motor releases the
// session and record exits non-zero once a loop reaches this many consecutive
// findings rounds: grinding that long signals a design-level problem for the human.
const MAX_FINDINGS_ROUNDS = 5;
// A mid-flight loop untouched this long is abandoned to the human; without this,
// a stale findings round would hold every later session in the project hostage.
const STALE_MS = 8 * 60 * 60 * 1000;

function git(args, input) {
  return execFileSync("git", args, {
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function codeTreeHash() {
  const files = [
    ...new Set(
      git(["ls-files", "--cached", "--others", "--exclude-standard"])
        .split("\n")
        .filter(Boolean)
        .filter((f) => !EXCLUDED.test(f)),
    ),
  ].sort();
  const present = files.filter((f) => existsSync(f));
  const hashes = present.length
    ? git(["hash-object", "--stdin-paths"], present.join("\n")).split("\n").filter(Boolean)
    : [];
  const byPath = new Map(present.map((f, i) => [f, hashes[i]]));
  // A tracked file missing on disk is a deletion; it must change the hash too.
  const manifest = files.map((f) => `${byPath.get(f) ?? "deleted"} ${f}`).join("\n");
  return git(["hash-object", "--stdin"], manifest).trim();
}

function statePath(change) {
  return path.join("openspec", "changes", change, "review-state.json");
}

function readState(change) {
  const file = statePath(change);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

function record(change, verdict) {
  if (!existsSync(path.join("openspec", "changes", change))) {
    console.error(`Unknown change "${change}" - no directory at openspec/changes/${change}.`);
    process.exit(1);
  }
  if (!VERDICTS.has(verdict)) {
    console.error(`Verdict must be "clean" or "findings", got "${verdict}".`);
    process.exit(1);
  }
  const state = readState(change) ?? { change, rounds: [] };
  state.rounds.push({ verdict, treeHash: codeTreeHash(), at: new Date().toISOString() });
  writeFileSync(statePath(change), JSON.stringify(state, null, 2) + "\n");
  console.log(
    `Recorded review round ${state.rounds.length} for "${change}": ${verdict} @ ${state.rounds.at(-1).treeHash}`,
  );
  const grinding = trailingFindings(state.rounds);
  if (grinding >= MAX_FINDINGS_ROUNDS) {
    console.error(
      `ESCALATE: ${grinding} consecutive findings rounds without convergence - the loop is grinding.\n` +
        `STOP iterating. Hand the punch list to the human: the change likely needs a design-level decision, not another fix round.`,
    );
    process.exit(1);
  }
}

function check(change) {
  const state = readState(change);
  const last = state?.rounds?.at(-1);
  if (!last) {
    return {
      ok: false,
      reason: `No review round recorded for "${change}". Run the code-review pass, then \`npm run review:record -- ${change} --verdict clean|findings\`.`,
    };
  }
  if (last.verdict !== "clean") {
    return {
      ok: false,
      reason: `Last recorded review round (${state.rounds.length}) found material findings. Apply fixes, re-run verify, re-review the fix delta in full context, then record the next round.`,
    };
  }
  if (last.treeHash !== codeTreeHash()) {
    return {
      ok: false,
      reason: `The code tree changed after the last clean review round (${state.rounds.length}) - the delta is unreviewed. Re-run verify, re-review the delta in full context, then record a new clean round.`,
    };
  }
  return {
    ok: true,
    reason: `Clean review round ${state.rounds.length} matches the current code tree.`,
  };
}

function gate() {
  // Hook protocol: JSON on stdin; exit 2 blocks the tool call and feeds stderr to the agent.
  if (process.stdin.isTTY) {
    console.error("gate is a Claude Code PreToolUse hook; it expects hook JSON on stdin.");
    process.exit(0);
  }
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const command = payload?.tool_input?.command;
  if (typeof command !== "string") process.exit(0);
  const m = command.match(/\bopenspec\s+archive\b\s*(\S*)/);
  if (!m) process.exit(0);
  const change = m[1] && !m[1].startsWith("-") ? m[1] : null;
  if (!change) {
    console.error(
      "Review-loop gate: pass the change name explicitly to `openspec archive <name>` so the gate can find its review record.",
    );
    process.exit(2);
  }
  const result = check(change);
  if (result.ok) process.exit(0);
  console.error(
    `Review-loop gate BLOCKED \`openspec archive ${change}\`.\n` +
      `${result.reason}\n` +
      `The loop is: apply fixes -> npm run verify -> re-review the fix delta in full context -> npm run review:record -- ${change} --verdict clean. Archive only after a clean round is recorded against the unchanged tree.`,
  );
  process.exit(2);
}

function trailingFindings(rounds) {
  let n = 0;
  for (const round of rounds.slice().reverse()) {
    if (round.verdict === "clean") break;
    n += 1;
  }
  return n;
}

function stopMotor() {
  // Stop hook: exit 2 blocks the agent from ending its turn and feeds stderr back
  // as the continuation instruction - this is what makes the next round
  // machine-triggered instead of human-triggered.
  if (process.stdin.isTTY) {
    console.error("stop is a Claude Code Stop hook; it expects hook JSON on stdin.");
    process.exit(0);
  }
  readFileSync(0, "utf8");
  const changesDir = path.join("openspec", "changes");
  if (!existsSync(changesDir)) process.exit(0);
  const midFlight = [];
  for (const entry of readdirSync(changesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "archive") continue;
    const state = readState(entry.name);
    const last = state?.rounds?.at(-1);
    if (!last || last.verdict === "clean") continue;
    if (trailingFindings(state.rounds) >= MAX_FINDINGS_ROUNDS) continue;
    if (Date.now() - Date.parse(last.at) > STALE_MS) continue;
    midFlight.push({ change: entry.name, round: state.rounds.length });
  }
  if (midFlight.length === 0) process.exit(0);
  const lines = midFlight.map(
    ({ change, round }) =>
      `- "${change}": round ${round} found material findings. Continue the loop: apply the fixes -> npm run verify -> re-review the fix delta in full context (surrounding code, callers, invariants) -> npm run review:record -- ${change} --verdict clean|findings.`,
  );
  console.error(
    `Review-loop motor: a review loop is mid-flight - do not stop.\n${lines.join("\n")}\n` +
      `The loop releases when a clean round is recorded, after ${MAX_FINDINGS_ROUNDS} consecutive findings rounds (escalate to the human with the punch list), or when genuinely blocked on input only the human can give (record the round first, then say so).`,
  );
  process.exit(2);
}

const [cmd, changeArg, ...rest] = process.argv.slice(2);
if (cmd === "record") {
  const verdict = rest[rest.indexOf("--verdict") + 1];
  record(changeArg, verdict ?? "");
} else if (cmd === "check") {
  const result = check(changeArg ?? "");
  console.log(result.reason);
  process.exit(result.ok ? 0 : 1);
} else if (cmd === "gate") {
  gate();
} else if (cmd === "stop") {
  stopMotor();
} else {
  console.error(
    "Usage: review-loop.mjs record <change> --verdict clean|findings | check <change> | gate | stop",
  );
  process.exit(1);
}
