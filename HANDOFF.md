# Agent Handoff System

> How agents pass context to each other through files

---

## The Handoff Chain

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT HANDOFF FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  @brainstormer                                                       │
│       │                                                              │
│       ▼ saves                                                        │
│  docs/decisions/YYYY-MM-DD-[topic]-decision.md                      │
│       │                                                              │
│       ▼ read by (complex features)                                   │
│  @architect                                                          │
│       │                                                              │
│       ▼ saves                                                        │
│  docs/architecture/YYYY-MM-DD-[feature]-architecture.md             │
│       │                                                              │
│       ▼ read by                                                      │
│  @planner                                                            │
│       │                                                              │
│       ▼ saves                                                        │
│  docs/plans/YYYY-MM-DD-[feature]-plan.md                            │
│       │                                                              │
│       ▼ read by                                                      │
│  @senior-developer ──────────────────┐                              │
│       │                              │                               │
│       ▼ triggers                     ▼ also read by                  │
│  @tester                          @tester                            │
│       │                              │                               │
│       ▼ saves                        ▼ saves                         │
│  docs/test-reports/...           docs/test-reports/...              │
│       │                              │                               │
│       ▼ read by                      │                               │
│  @code-reviewer ◀────────────────────┘                              │
│       │                                                              │
│       ▼ saves                                                        │
│  docs/code-reviews/YYYY-MM-DD-[feature].md                          │
│       │                                                              │
│       ▼ read by                                                      │
│  @senior-developer (to fix issues)                                   │
│       │                                                              │
│       ▼ triggers                                                     │
│  @git-manager                                                        │
│       │                                                              │
│       ▼                                                              │
│  ✅ MERGED                                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Locations

| Agent | Output Location | Read By |
|-------|-----------------|---------|
| `@brainstormer` | `docs/decisions/YYYY-MM-DD-[topic]-decision.md` | `@architect`, `@planner` |
| `@architect` | `docs/architecture/YYYY-MM-DD-[feature]-architecture.md` | `@planner`, `@database-admin`, `@devops` |
| `@planner` | `docs/plans/YYYY-MM-DD-[feature]-plan.md` | `@senior-developer`, `@tester` |
| `@researcher` | `docs/research/YYYY-MM-DD-[topic].md` | `@brainstormer`, `@planner` |
| `@tester` | `docs/test-reports/YYYY-MM-DD-[scope].md` | `@code-reviewer` |
| `@debugger` | `docs/debug-reports/YYYY-MM-DD-[issue].md` | `@senior-developer` |
| `@code-reviewer` | `docs/code-reviews/YYYY-MM-DD-[feature].md` | `@senior-developer` |
| `@ui-ux-designer` | `docs/design-reports/YYYY-MM-DD-[component].md` | `@senior-developer` |

---

## How to Use Handoffs

### Method 1: Explicit File Reference (Most Reliable)

```bash
# Step 1: Brainstormer creates decision
> "@brainstormer explore authentication options for our app"
# Output: docs/decisions/2025-01-11-auth-decision.md

# Step 2: Planner reads decision and creates plan
> "@planner create plan based on docs/decisions/2025-01-11-auth-decision.md"
# Output: docs/plans/2025-01-11-auth-plan.md

# Step 3: Developer implements from plan
> "@senior-developer implement Phase 1 from docs/plans/2025-01-11-auth-plan.md"
```

### Method 2: Automatic Handoff Prompt

Each agent ends with a "Next step" prompt:

```
✅ Decision saved: docs/decisions/2025-01-11-auth-decision.md

Next step:
"@planner create plan based on docs/decisions/2025-01-11-auth-decision.md"
```

Just copy and paste the next step command.

### Method 3: Full Pipeline Command

```bash
> "Implement user authentication:
   1. @brainstormer explore options and save decision
   2. @planner create implementation plan from decision
   3. @senior-developer implement the plan
   4. @tester write tests
   5. @code-reviewer review
   6. @git-manager create PR"
```

Claude will orchestrate and ensure each agent reads the previous agent's output.

---

## Example: Complete Feature Flow

### Step 1: Brainstorm

```bash
> "@brainstormer should we use JWT or sessions for authentication?"
```

**Agent outputs:**

```
✅ Decision document saved: docs/decisions/2025-01-11-auth-method-decision.md

**Recommendation**: JWT with refresh tokens
- Stateless, scalable
- Works with mobile apps
- Team has experience

**Next step**:
"@planner create implementation plan based on docs/decisions/2025-01-11-auth-method-decision.md"
```

### Step 2: Plan

```bash
> "@planner create implementation plan based on docs/decisions/2025-01-11-auth-method-decision.md"
```

**Agent outputs:**

```
✅ Plan created: docs/plans/2025-01-11-jwt-auth-plan.md

Based on: docs/decisions/2025-01-11-auth-method-decision.md

**Phases**:
- Phase 1: User model, types (2h)
- Phase 2: Auth service (4h)
- Phase 3: API endpoints (3h)
- Phase 4: Tests (3h)

**Next step**:
"@senior-developer implement Phase 1 from docs/plans/2025-01-11-jwt-auth-plan.md"
```

### Step 3: Implement

```bash
> "@senior-developer implement Phase 1 from docs/plans/2025-01-11-jwt-auth-plan.md"
```

**Agent reads plan, implements, then:**

```
✅ Phase 1 complete

Files created:
- src/models/user.ts
- src/types/auth.ts

**Next step**:
"@senior-developer implement Phase 2 from docs/plans/2025-01-11-jwt-auth-plan.md"

Or test first:
"@tester write tests for Phase 1 (user model)"
```

### Step 4: Test

```bash
> "@tester write tests for auth module based on docs/plans/2025-01-11-jwt-auth-plan.md"
```

**Agent outputs:**

```
✅ Test report: docs/test-reports/2025-01-11-auth.md

Coverage: 87%
Tests: 12 passed, 0 failed

**Next step**:
"@code-reviewer review auth implementation"
```

### Step 5: Review

```bash
> "@code-reviewer review auth implementation. 
   Decision: docs/decisions/2025-01-11-auth-method-decision.md
   Plan: docs/plans/2025-01-11-jwt-auth-plan.md"
```

**Agent outputs:**

```
✅ Code review: docs/code-reviews/2025-01-11-auth.md

**Verdict**: Approve with comments

**Issues**:
- 🟡 Medium: Add rate limiting to login endpoint

**Next step**:
"@senior-developer fix medium priority issues from docs/code-reviews/2025-01-11-auth.md"
```

### Step 6: Fix & Merge

```bash
> "@senior-developer fix issues from docs/code-reviews/2025-01-11-auth.md"
> "@git-manager commit and create PR for authentication feature"
```

---

## Directory Structure

```
docs/
├── decisions/              # @brainstormer outputs
│   ├── 2025-01-11-auth-decision.md
│   └── 2025-01-10-database-decision.md
│
├── plans/                  # @planner outputs
│   ├── 2025-01-11-auth-plan.md
│   └── 2025-01-10-database-plan.md
│
├── research/               # @researcher outputs
│   └── 2025-01-11-jwt-best-practices.md
│
├── test-reports/           # @tester outputs
│   └── 2025-01-11-auth.md
│
├── debug-reports/          # @debugger outputs
│   └── 2025-01-10-login-500-error.md
│
├── code-reviews/           # @code-reviewer outputs
│   └── 2025-01-11-auth.md
│
└── design-reports/         # @ui-ux-designer outputs
    └── 2025-01-11-login-form.md
```

---

## Handoff Commands Quick Reference

### From @brainstormer → @planner

```bash
# Brainstormer ends with:
"@planner create plan based on docs/decisions/[file].md"
```

### From @planner → @senior-developer

```bash
# Planner ends with:
"@senior-developer implement Phase 1 from docs/plans/[file].md"
```

### From @senior-developer → @tester

```bash
# Developer ends with:
"@tester write tests based on docs/plans/[file].md"
```

### From @tester → @code-reviewer

```bash
# Tester ends with:
"@code-reviewer review. Test report: docs/test-reports/[file].md"
```

### From @code-reviewer → @senior-developer

```bash
# Reviewer ends with:
"@senior-developer fix issues from docs/code-reviews/[file].md"
```

### From @senior-developer → @git-manager

```bash
# Developer ends with:
"@git-manager commit and create PR"
```

---

## Ensuring Continuity

### Rule 1: Always Save to File

Agents must save their output to the appropriate `docs/` folder.

### Rule 2: Always Reference Previous Output

When invoking the next agent, include the file path:

```bash
# ✅ Good - explicit reference
"@planner create plan based on docs/decisions/2025-01-11-auth-decision.md"

# ❌ Bad - no reference, context may be lost
"@planner create a plan for auth"
```

### Rule 3: Check for Existing Documents

Before starting, agents should check if relevant documents exist:

```bash
# Planner checks for decisions
ls docs/decisions/ | grep auth

# Developer checks for plans
ls docs/plans/ | grep auth
```

### Rule 4: End with Next Step

Every agent should end with:

```
**Next step**:
"@[next-agent] [action] based on [file-path]"
```

---

## Troubleshooting Handoffs

### Problem: Planner doesn't see brainstormer output

```bash
# Explicitly reference the file
> "@planner read docs/decisions/2025-01-11-auth-decision.md and create plan"
```

### Problem: Context lost between sessions

```bash
# Start new session with references
> "Continue auth implementation.
   Decision: docs/decisions/2025-01-11-auth-decision.md
   Plan: docs/plans/2025-01-11-auth-plan.md
   Progress: Phase 2 complete, starting Phase 3"
```

### Problem: Don't know what file was created

```bash
# List recent documents
> "List all docs in docs/decisions/ and docs/plans/"
```

---

## Best Practices

1. **Always use dated filenames**: `YYYY-MM-DD-[topic].md`
2. **Reference files explicitly**: Don't rely on context memory
3. **Follow the chain**: Don't skip agents in the flow
4. **Check for existing docs**: Avoid duplicate analysis
5. **Update docs as you go**: Keep them current
6. **Use /clear between features**: Fresh context per feature

---

## Quick Commands

```bash
# Full pipeline with handoffs
> "Implement [feature]:
   - @brainstormer → save to docs/decisions/
   - @planner → read decision, save to docs/plans/
   - @senior-developer → implement from plan
   - @tester → test and save report
   - @code-reviewer → review all
   - @git-manager → commit and PR"

# Resume from specific point
> "Continue from docs/plans/2025-01-11-auth-plan.md, Phase 3"

# Check what exists
> "Show all docs related to auth feature"
```