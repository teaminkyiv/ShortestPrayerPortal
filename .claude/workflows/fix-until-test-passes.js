export const meta = {
  name: 'fix-until-test-passes',
  description: 'Spin one agent with /goal to fix a specific test until it passes (max 5 turns)',
  phases: [
    { title: 'Fix', detail: 'Agent uses /goal to run, diagnose, and fix the test iteratively' },
  ],
}

// args: test target — a Playwright file path or grep pattern.
// Examples:
//   "tests/e2e/us1-auth.spec.ts"
//   "tests/e2e/us1-auth.spec.ts:12"
//   "--grep 'US-1'"
// Defaults to full test suite if omitted.
const testTarget = args || 'tests/e2e'

log(`Target: ${testTarget}`)

const result = await agent(
  `/goal \`npx playwright test ${testTarget} --reporter=line\` exits 0
and the full test output (pass/fail counts and any error messages) is shown in the transcript
and no file under tests/ is modified
and no source function is removed or stubbed out
— or stop after 5 turns

CONTEXT:
- Next.js 15 App Router project, TypeScript
- Playwright E2E tests in tests/e2e/
- Dev server must be running for Playwright tests (start with: npm run dev)
- Test seed script if needed: npm run seed:test (requires .env.test)

CONSTRAINTS:
- Never modify files under tests/
- Fix only what the error output proves is broken — no speculative changes
- Do not install new packages without a clear reason from the error
- Do not hardcode values or stub functions to fake a passing test

DONE WHEN:
npx playwright test ${testTarget} --reporter=line exits 0 with real passing tests

VERIFY:
Show the full terminal output of the final test run in the transcript so the evaluator can confirm the exit code and pass counts.

STOP RULES:
Stop after 5 turns whether or not the goal is met. On each turn, start by running the test and showing its full output.`,
  { label: 'fix-test', phase: 'Fix' }
)

return { testTarget, result }
