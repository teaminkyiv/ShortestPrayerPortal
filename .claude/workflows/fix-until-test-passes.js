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

BEFORE RUNNING THE TEST — SERVER SETUP (do this first, every turn):
1. Check if port 3000 is free: lsof -ti:3000
2. If occupied — kill it: kill $(lsof -ti:3000)
3. Start fresh dev server in background: npm run dev > /tmp/dev-server.log 2>&1 &
4. Wait until /admin/login responds 200 or 302:
   until curl -sf http://localhost:3000/admin/login -o /dev/null -w "%{http_code}" | grep -qE "200|302"; do sleep 3; done
5. Then run the test with CI=true to prevent Playwright from spawning its own server:
   CI=true npx playwright test ${testTarget} --reporter=line

CONTEXT:
- Next.js 15 App Router project, TypeScript
- Playwright E2E tests in tests/e2e/
- Test seed script if needed: npm run seed:test (requires .env.test)
- Always use CI=true when running playwright (prevents webServer timeout conflicts)

WHAT TO DO EACH TURN:
1. Run the test and show full output.
2. If it passes — you're done.
3. If it fails — read the error, identify the root cause in the source code, apply the minimal fix, then re-run to confirm.

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
