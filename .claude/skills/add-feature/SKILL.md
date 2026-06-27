# Add Feature Skill

Use this skill when the user asks to add a new feature to the project.

## The Pattern

Run four sequential agents — each one waits for the previous to finish before starting:

```
Agent 1 → Document  →  Agent 2 → Implement  →  Agent 3 → Tests  →  Workflow → Fix
```

---

## Step 1 — Document (Agent)

Spawn an agent to update docs. It must:

1. Add the user story (US-N) to the PRD at `docs/superpowers/plans/2026-06-26-admin-panel.md`:
   - Problem statement
   - Acceptance criteria
   - DB schema changes (if any)
   - New routes / components list
   - Implementation task (Task N)

2. Add scenarios to `specs/` (or create the file if it doesn't exist):
   - One `.md` file per US with Given/When/Then scenarios

3. **Do NOT write any code.** Documentation only.

---

## Step 2 — Implement (Agent)

Spawn an agent to implement the feature. It must:

1. Read the PRD task added in Step 1
2. Implement all code: DB schema, migrations, API routes, UI components, service layer
3. Follow the existing project conventions (Next.js 15 App Router, Drizzle ORM, Tailwind)
4. Commit all changes with a descriptive message
5. **Do NOT write E2E tests** — that's Step 3

---

## Step 3 — E2E Tests (Agent)

Spawn an agent to write E2E tests. It must:

1. Read the scenarios from Step 1
2. Create `tests/e2e/us{N}-{feature}.spec.ts` following the existing test style (Given/When/Then with `test.step()`)
3. Use `TEST_*` env vars from `.env.test` for IDs
4. Commit the test file
5. **Do NOT run the tests** — that's Step 4

---

## Step 4 — Fix Until Tests Pass (Workflow)

Invoke the `fix-until-test-passes` workflow:

```javascript
Workflow({
  scriptPath: ".claude/workflows/fix-until-test-passes.js",
  args: "tests/e2e/us{N}-{feature}.spec.ts",
});
```

Max 5 iterations. Agent fixes source code (never tests) until all pass.

---

## Rules

- Sequential only — never run agents in parallel
- Each agent gets only what it needs: task description + relevant file paths + conventions
- Never skip a step even if the feature "seems simple"
- After Step 4: commit passing state + report to user

---

## How to invoke

When user says "add feature X" or "implement US-N":

1. Ask for the feature description if not clear
2. Run the 4 steps above in order
3. Report after each step completes
