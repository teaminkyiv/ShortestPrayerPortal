# Claude Code `/goal` Command — Best Practices

> Source: [official Claude Code docs](https://code.claude.com/docs/en/goal)  
> Requires Claude Code v2.1.139+

---

## What it does

`/goal` sets a completion condition and Claude keeps working across turns until the condition is met. After each turn, a small fast model (Haiku by default) reads the conversation and checks: *is the condition met?* A "no" feeds the reason back as the next turn's instruction. A "yes" clears the goal.

Internally it is a session-scoped wrapper around a [prompt-based Stop hook](https://code.claude.com/docs/en/hooks-guide#prompt-based-hooks).

---

## Basic usage

```text
/goal all tests in test/auth pass and the lint step is clean
```

Setting a goal **starts a turn immediately** — no need to send a separate prompt. A `◎ /goal active` indicator shows while it's running.

```text
/goal              # check status: turns, tokens, evaluator's last reason
/goal clear        # cancel before condition is met
```

Aliases for `clear`: `stop`, `off`, `reset`, `none`, `cancel`.

Run in non-interactive / headless mode:

```bash
claude -p "/goal CHANGELOG.md has an entry for every PR merged this week"
```

---

## Writing an effective condition

The evaluator reads **the conversation transcript only** — it runs no tools and reads no files independently. Write the condition as something Claude's own output can demonstrate.

A condition that holds across many turns has three parts:

| Part | Example |
|------|---------|
| **One measurable end state** | test result, build exit code, file count, empty queue |
| **A stated check** | "`npm test` exits 0", "`git status` is clean" |
| **Constraints that matter** | "no other test file is modified", "no new packages installed" |

Max condition length: **4,000 characters**.

**Works:**
```
/goal every import of ./oldModule has been replaced with ./newModule
       and `tsc --noEmit` exits 0
```

**Doesn't work:**
```
/goal the code looks good and is well designed
```
"Looks good" is not observable from a transcript.

---

## Add a safety cap

Include a turn or time clause to prevent an impossible goal from running forever:

```
/goal all tests in test/auth pass — or stop after 20 turns
```

Claude reports progress against that clause each turn and the evaluator judges it from the conversation.

---

## `/goal` vs `/loop` vs Stop hook

| Approach | Next turn starts when | Stops when |
|----------|-----------------------|------------|
| `/goal` | Previous turn finishes | A model confirms condition is met |
| `/loop` | Time interval elapses | You stop it, or Claude decides it's done |
| Stop hook | Previous turn finishes | Your own script or prompt decides |

- Use **`/goal`** for finite work with a clear finish line.
- Use **`/loop`** for ongoing monitoring or polling (e.g., watch CI, shepherd PRs).
- Use a **Stop hook** when you need deterministic or custom evaluation logic that lives across sessions.

**Anti-patterns:**
- `/goal` to poll external state → condition can never be met by Claude's actions; use `/loop` instead.
- `/loop` for work that has a finish line → re-runs blindly on the clock, never knowing it's done.

---

## Pairing with auto mode

[Auto mode](https://code.claude.com/docs/en/auto-mode-config) approves tool calls within a single turn. `/goal` removes the per-turn prompts. Together they make fully unattended runs:

- Auto mode → no tool-call interruptions mid-turn  
- `/goal` → no "continue?" prompt between turns

---

## Resume behaviour

A goal still active when a session ends is **restored** on `--resume` or `--continue`. The condition carries over but the turn count, timer, and token baseline reset. An already-achieved or cleared goal is not restored.

---

## Requirements

`/goal` requires:
- The workspace trust dialog to have been accepted (it uses the hooks system).
- `disableAllHooks` must **not** be set at any settings level.
- `allowManagedHooksOnly` must **not** be set in managed settings.

The command will tell you why it's unavailable instead of silently doing nothing.

---

## When to use `/goal`

Good fits — finite work with a verifiable finish line:

- Migrating a module to a new API until every call site compiles and tests pass
- Implementing a design doc until all acceptance criteria hold
- Splitting a large file into focused modules until each is under a size budget
- Working through a labeled issue backlog until the queue is empty
- Fixing a failing test until it goes green (see also the `fix-until-test-passes` workflow)

Bad fits:

- Subjective quality ("looks clean", "feels right") — encode as a linter/formatter exit code instead
- Polling an external deploy or CI run — use `/loop` instead
- One-shot quick tasks — just prompt directly

---

## Community experiences & real-world gotchas

These are patterns discovered by developers using `/goal` in practice — things not covered (or under-covered) in the official docs.

### The token burn risk

One developer on a $200/month account burned their **entire weekly token budget in a 14-hour overnight session** because the goal condition was vague enough to never definitively resolve. There is no built-in spending cap. Always add `or stop after N turns` and monitor the first unattended run.

### Model choice matters enormously

A Java coding problem was tested with two models:
- **Opus 4.8** — solved in ~2 minutes
- **Haiku 4.5** — same task, 25 minutes and 46,000 tokens through persistent retry cycles

The evaluator defaults to Haiku but the worker model is what you configured for the session. For hard problems, use a capable model or the loop becomes expensive.

### Acknowledgement loops — the most common failure mode

Claude can write a confident summary of incomplete or broken work. The evaluator reads the transcript, not the actual state, so it can judge a goal "achieved" based on Claude's self-report rather than real results. Two defences:

1. Write the condition so it requires Claude to show **command output** in the transcript (exit codes, test results), not just a summary.
2. After the goal clears, **audit the result yourself** — "achieved" means the evaluator was satisfied, not that the work is actually correct.

### The verification trap

A goal focused only on making tests pass can produce technically correct but practically useless output. Example: a goal of "all tests pass" was satisfied by stubbing rendering — the visual output was never actually checked.

**Fix:** Write what you want, not just how to check it. Include positive constraints alongside exit codes:

```
/goal all tests in test/auth pass (npm test exits 0),
      no test file under tests/ is modified,
      and no function is removed or stubbed out
```

### The "make the linter happy" trap

Over-narrow goals create unintended side effects. "Make ESLint report zero errors" without guardrails can be satisfied by deleting the offending code.

Always protect adjacent concerns:
```
/goal ESLint reports zero errors in src/
      and all existing tests still pass (npm test exits 0)
      and no source file is deleted
```

### Context gaps cause circular work

Without project structure and conventions established before the goal starts, Claude makes assumptions that require mid-loop correction, wasting turns. Do your setup prompts first, then set the goal.

### Condition structure that circulated in the community

A 9-section template emerged from community discussion. Simpler tasks need only 3 sentences, but for complex unattended work:

```
GOAL: [what you want]
CONTEXT: [relevant background]
CONSTRAINTS: [what must not change]
PRIORITY: [if tradeoffs arise]
PLAN: [suggested approach, optional]
DONE WHEN: [the measurable end state]
VERIFY: [how Claude should prove it in the transcript]
OUTPUT: [what to produce/report]
STOP RULES: [turn/time cap]
```

### Specify constraints to prevent gaming

For algorithmic tasks, Claude can satisfy a test by hardcoding the expected output rather than implementing real logic. Prevent it explicitly:

```
/goal running javac Zoo.java ZooTest.java && java ZooTest exits 0,
      without modifying ZooTest.java,
      and without hardcoding the printed lines
```

### Without auto mode, overnight runs stall at the first tool confirmation

Auto mode is not optional for truly unattended `/goal` runs. The first tool-call confirmation prompt will pause the loop indefinitely until you respond.

---

## See also (official docs)

- [Run a prompt repeatedly with `/loop`](https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-%2Floop)
- [Prompt-based Stop hooks](https://code.claude.com/docs/en/hooks-guide#prompt-based-hooks)
- [Auto mode config](https://code.claude.com/docs/en/auto-mode-config)
- [Scheduling comparison](https://code.claude.com/docs/en/scheduled-tasks#compare-scheduling-options)
