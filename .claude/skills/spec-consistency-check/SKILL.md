---
name: spec-consistency-check
description: Use when any file inside specs/ is created, modified, or deleted. Triggers a full consistency, error, ambiguity, and cross-document contradiction check across all spec files.
---

# Spec Consistency Check

## Overview

Any change to a spec document can silently break another. This skill enforces a mandatory review pass over the entire `specs/` folder whenever anything in it changes.

## When to Use

- A spec file was just created, edited, or deleted
- You are about to commit a change that touches `specs/`
- Someone asks "is the PRD up to date?" or "do the specs contradict?"

## Required Steps

Run ALL four checks in order. Do not skip any. Do not commit spec changes without completing this skill.

### 1. Internal Consistency (per document)

Read each file in `specs/`. For every document ask:
- Do terms, field names, and values used later match how they were defined earlier?
- Are state machine transitions complete and non-contradictory?
- Do user stories reference pages, fields, or statuses that actually exist in the same document?

Flag: any name mismatch, missing definition, or forward reference to something never defined.

### 2. Error Check (per document)

- Broken internal links (`[file.md](file.md)` pointing to non-existent files)
- DB schema field names referenced in user stories that don't exist in the schema
- Env var names used in text that don't appear in the BYOK table
- Route paths in user stories that don't appear in the navigation section

### 3. Ambiguity Check (per document)

Flag any statement where a developer could reasonably make two different implementation choices:
- "show an error" — what kind? toast, inline, modal?
- "validate input" — what rules?
- "recent" — how many? what time window?

Each ambiguity must be either resolved (add detail) or explicitly deferred to "not in MVP".

### 4. Cross-Document Contradiction Check

Read `specs/INDEX.md` to get the full list of spec files. Then compare every pair:
- Does terminology match across documents? (same concept called different names?)
- Do acceptance criteria in `user-scenarios.md` match the rules in the PRD?
- Do field names in scenarios match the DB schema in the PRD?
- Does any document assume a feature another document explicitly excludes?

## Output Format

Report findings grouped by check type:

```
## Spec Consistency Report

### Internal Consistency
- [filename] line ~N: <issue>

### Errors
- [filename]: <issue>

### Ambiguities
- [filename] US-X: <ambiguous statement> → Suggested resolution: ...

### Cross-Document Contradictions
- [file-A] vs [file-B]: <contradiction>
```

If no issues found in a category, write "✓ Clean".

## Rules

- **Never commit spec changes without running this skill first**
- Fix all Errors and Contradictions before committing
- Ambiguities must be either resolved or explicitly marked `[deferred: not in MVP]`
- Internal consistency issues must be resolved — no exceptions
- After fixing, re-run the check to confirm clean

## Common Mistakes

| Mistake | Fix |
|---|---|
| Only checking the file you just edited | Always check ALL files in `specs/` |
| Skipping cross-document check because "I only changed one thing" | One change can contradict many documents |
| Marking something "ambiguous" and moving on | Resolve it or explicitly defer it — ambiguity is a bug |
| Checking consistency but not errors | Run all four checks every time |
