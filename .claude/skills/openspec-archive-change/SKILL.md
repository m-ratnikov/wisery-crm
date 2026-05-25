---
name: openspec-archive-change
description: Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.3.1"
---

Archive a completed change in the experimental workflow.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `artifacts`: List of artifacts with their status (`done` or other)

   **If any artifacts are not `done`:**
   - Display warning listing incomplete artifacts
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically `tasks.md`) to check for incomplete tasks.

   Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

   **If no tasks file exists:** Proceed without task-related warning.

4. **Assess delta spec sync state**

   Check for delta specs at `openspec/changes/<name>/specs/`. If none exist, proceed without sync prompt.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `openspec/specs/<capability>/spec.md`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary before prompting

   **Prompt options:**
   - If changes needed: "Sync now (recommended)", "Archive without syncing"
   - If already synced: "Archive now", "Sync anyway", "Cancel"

   This assessment is informational only. The actual sync is performed by the `openspec archive` CLI in step 5 (it merges delta specs into the main specs AND validates by default). Do NOT hand-merge specs or invoke a separate `openspec-sync-specs` skill - that path skips validation and has shipped malformed canonical specs (Fission-AI/OpenSpec issues #863, #913). If the user chooses "Archive without syncing", pass `--skip-specs` in step 5.

5. **Perform the archive (use the CLI)**

   Archive with the OpenSpec CLI, which moves the change into `openspec/changes/archive/`, merges its delta specs into `openspec/specs/`, and validates by default:

   ```bash
   openspec archive "<name>" --yes
   ```

   - Do NOT hand-roll the move (`mv`) or the spec merge. The manual path bypasses the CLI's validation and has produced invalid canonical specs (missing `## Purpose` / `## Requirements`) - Fission-AI/OpenSpec issues #863 and #913.
   - For an infrastructure / tooling / doc-only change with no spec to promote, add `--skip-specs`.
   - If the CLI reports validation errors, fix the delta or canonical spec and re-run. Do NOT pass `--no-validate`.
   - Report whatever archive path and spec changes the CLI prints in step 6.

6. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - Whether specs were synced (if applicable)
   - Note about any warnings (incomplete artifacts/tasks)

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync skipped")

All artifacts complete. All tasks complete.
```

**Guardrails**
- Always prompt for change selection if not provided
- Use artifact graph (openspec status --json) for completion checking
- Don't block archive on warnings - just inform and confirm
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Show clear summary of what happened
- Archive and spec sync are done by `openspec archive <name> --yes` (it merges specs and validates by default); never hand-move the folder or hand-merge/hand-write canonical specs (Fission-AI/OpenSpec #863, #913)
- If delta specs exist, always run the sync assessment and show the combined summary before prompting
