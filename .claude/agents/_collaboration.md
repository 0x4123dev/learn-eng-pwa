# Agent Collaboration Rules

> Defines how agents work together, dependencies, and execution constraints

---

## Agent Dependency Graph

```
                    ┌─────────────┐
                    │    USER     │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ @researcher │ │@brainstormer│ │   @scout    │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │              (info only)
           └───────┬───────┘
                   ▼
           ┌─────────────┐
           │ @architect  │  (for complex features)
           └──────┬──────┘
                  │
                  ▼
           ┌─────────────┐
           │  @planner   │
           └──────┬──────┘
                  │
    ┌─────────────┼─────────────┬─────────────┐
    ▼             ▼             ▼             ▼
┌────────┐ ┌────────────┐ ┌──────────┐ ┌─────────┐
│@db-admin│ │@ui-designer│ │ @devops  │ │@senior- │
└────┬───┘ └─────┬──────┘ └────┬─────┘ │developer│
     │           │              │       └────┬────┘
     └───────────┴──────────────┴────────────┘
                        │
                        ▼
                 ┌─────────────┐
                 │   @tester   │
                 └──────┬──────┘
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   ┌─────────────┐           ┌────────────────┐
   │@code-reviewer│           │@security-auditor│
   └──────┬──────┘           └────────┬───────┘
          │                           │
          └─────────────┬─────────────┘
                        ▼
                 ┌─────────────┐
                 │@docs-manager│
                 └──────┬──────┘
                        ▼
                 ┌─────────────┐
                 │ @git-manager│
                 └─────────────┘
```

---

## Required Handoffs (MUST Follow)

These handoffs are mandatory for quality and consistency:

| Before | Must Complete | Reason |
|--------|---------------|--------|
| `@planner` starts | `@brainstormer` decision exists | Plans need decisions |
| `@architect` starts | `@brainstormer` decision exists | Architecture needs direction |
| `@senior-developer` implements | `@planner` plan exists | Code needs plan |
| `@code-reviewer` reviews | `@tester` report exists | Review needs test results |
| `@git-manager` commits | `@code-reviewer` approved | Must have review |
| `@git-manager` pushes to main | All tests pass | Quality gate |

### Enforcement

```markdown
## Handoff Verification Checklist

### Before @planner:
- [ ] Decision document exists in docs/decisions/
- [ ] Read decision before planning

### Before @senior-developer:
- [ ] Plan document exists in docs/plans/
- [ ] Understand all phases before starting

### Before @code-reviewer:
- [ ] Test report exists in docs/test-reports/
- [ ] All tests passing

### Before @git-manager commit:
- [ ] Code review status: Approved
- [ ] No blocking issues remain

### Before @git-manager push/PR:
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No secrets in code
```

---

## Parallel Execution (CAN Run Together)

These agents can run simultaneously without conflicts:

### Information Gathering Phase
```
@researcher ─┬─ Can run together
@scout      ─┘
```
**Why**: Both gather information, no writes conflict

### Analysis Phase
```
@brainstormer ─┬─ Can run if different topics
@researcher   ─┘
```
**Why**: Different output locations, independent analysis

### Quality Phase
```
@tester           ─┬─ Can run together after implementation
@security-auditor ─┘
```
**Why**: Different focus areas, both read-only on code

### Finalization Phase
```
@docs-manager ─┬─ Can run together
@git-manager  ─┘   (if docs-manager finishes first)
```
**Why**: Different file targets, sequential for commit

### Parallel Planning (Different Features)
```
Feature A: @planner ─┬─ Can run if different features
Feature B: @planner ─┘
```
**Why**: Separate plan files, no conflicts

---

## Sequential Execution (CANNOT Run Together)

These agents must run one after another:

### Same Feature Constraint
```
@brainstormer → @architect → @planner
```
**Why**: Each depends on previous output

### Same Code Constraint
```
@senior-developer → @tester → @code-reviewer
```
**Why**: Code must be written before testing, testing before review

### Review-Fix Cycle
```
@code-reviewer → @senior-developer (fixes) → @code-reviewer (re-review)
```
**Why**: Must fix issues before re-review

### Commit Constraint
```
All agents → @git-manager
```
**Why**: Git operations are final step, need all work complete

---

## Conflict Resolution

### Same File Conflicts

If two agents need the same file:

```markdown
1. First agent takes priority
2. Second agent waits or works on different section
3. Use file locking pattern:
   - Agent A: "Working on src/auth/login.ts"
   - Agent B: "Waiting for Agent A to complete"
```

### Decision Conflicts

If agents disagree on approach:

```markdown
1. Escalate to @brainstormer for decision
2. Document conflict in decision doc
3. User makes final call if needed
```

### Merge Conflicts

If code conflicts occur:

```markdown
1. @git-manager detects conflict
2. @senior-developer resolves
3. @tester re-runs tests
4. @code-reviewer re-reviews if significant
```

---

## Communication Protocol

### Status Indicators

| Symbol | Meaning | Next Action |
|--------|---------|-------------|
| ✅ | Complete, proceed | Next agent can start |
| ⚠️ | Complete with warnings | Review warnings, then proceed |
| ❌ | Blocked/Failed | Fix issue before proceeding |
| 🔄 | In progress | Wait for completion |
| ⏸️ | Paused, needs input | User action required |

### Urgency Levels

| Level | Symbol | Meaning | Response Time |
|-------|--------|---------|---------------|
| Critical | 🔴 | Security/data issue | Immediate |
| High | 🟠 | Blocking issue | Same session |
| Medium | 🟡 | Should fix soon | Before merge |
| Low | 🟢 | Nice to have | Backlog |

### Handoff Message Format

```markdown
## Handoff: @[current-agent] → @[next-agent]

**Status**: [✅/⚠️/❌]
**Output**: [file path]

### Summary
[2-3 sentences describing what was done]

### Key Decisions
- [Decision 1]
- [Decision 2]

### Blockers (if any)
- [Blocker 1]

### Next Action
"@[next-agent] [specific action] from [file path]"
```

---

## Agent Responsibilities Matrix

| Responsibility | Primary Agent | Backup Agent |
|----------------|---------------|--------------|
| Architecture decisions | @brainstormer | @architect |
| Technical research | @researcher | @brainstormer |
| System design | @architect | @planner |
| Implementation planning | @planner | @senior-developer |
| Code implementation | @senior-developer | - |
| Database changes | @database-admin | @senior-developer |
| UI/UX design | @ui-ux-designer | @researcher |
| Test writing | @tester | @senior-developer |
| Code quality | @code-reviewer | @senior-developer |
| Security | @security-auditor | @code-reviewer |
| Bug investigation | @debugger | @senior-developer |
| Documentation | @docs-manager | @senior-developer |
| Git operations | @git-manager | @senior-developer |
| Infrastructure | @devops | @senior-developer |
| Codebase exploration | @scout | @senior-developer |

---

## Workflow Templates

### Standard Feature Workflow
```
@brainstormer → @planner → @senior-developer → @tester → @code-reviewer → @git-manager
```

### Complex Feature Workflow
```
@researcher → @brainstormer → @architect → @planner → @senior-developer → @tester → @security-auditor → @code-reviewer → @docs-manager → @git-manager
```

### Bug Fix Workflow
```
@debugger → @senior-developer → @tester → @code-reviewer → @git-manager
```

### Security Fix Workflow
```
@security-auditor → @senior-developer → @tester → @security-auditor → @code-reviewer → @git-manager
```

### Database Change Workflow
```
@brainstormer → @database-admin → @senior-developer → @tester → @code-reviewer → @git-manager
```

### UI Feature Workflow
```
@researcher → @ui-ux-designer → @senior-developer → @tester → @code-reviewer → @git-manager
```

---

## Quality Gates

### Gate 1: Before Implementation
```
Required:
- [ ] Decision document (if complex)
- [ ] Plan document
- [ ] Architecture document (if complex)
```

### Gate 2: Before Review
```
Required:
- [ ] Implementation complete
- [ ] Tests written
- [ ] Tests passing
- [ ] Lint passing
- [ ] Types passing
```

### Gate 3: Before Merge
```
Required:
- [ ] Code review approved
- [ ] Security check passed (if auth/data changes)
- [ ] Documentation updated
- [ ] All CI checks green
```

### Gate 4: Before Production
```
Required:
- [ ] Staging deployment successful
- [ ] Smoke tests passed
- [ ] Performance baseline met
- [ ] Rollback plan documented
```

---

## Error Recovery

### Agent Failure Recovery

| Failure | Recovery Action |
|---------|-----------------|
| @brainstormer stuck | User provides direction |
| @planner incomplete | Resume from partial plan |
| @senior-developer error | @debugger investigates |
| @tester failures | @senior-developer fixes |
| @code-reviewer rejects | @senior-developer fixes, re-review |
| @git-manager conflict | @senior-developer resolves |

### Session Recovery

If context is lost between sessions:

```bash
# Restore context
"Continue [feature] work.
 Decision: docs/decisions/[file].md
 Plan: docs/plans/[file].md
 Progress: [current phase/status]"
```

---

## Best Practices

### 1. Always Reference Files
```bash
# ✅ Good
"@planner create plan from docs/decisions/2025-01-11-auth.md"

# ❌ Bad
"@planner create a plan"
```

### 2. Clear Context Between Features
```bash
> /clear
> "Starting new feature: [name]"
```

### 3. Check Before Starting
```bash
# Before any agent, check dependencies
"What decision/plan documents exist for [feature]?"
```

### 4. Complete One Phase Before Next
```bash
# ✅ Good
Phase 1 complete → Test Phase 1 → Phase 2

# ❌ Bad
Phase 1 + Phase 2 + Phase 3 → Test all
```

### 5. Document Blockers
```bash
# If blocked, document why
"Blocked: Need API spec from backend team
 Saved partial work to: docs/plans/..."
```

---

## Anti-Patterns (Avoid These)

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Skip @brainstormer | No decision record | Always document decisions |
| Skip @tester | No test coverage | Always test before review |
| Skip @code-reviewer | Quality issues | Always review before merge |
| Multiple agents same file | Conflicts | Sequential access |
| No file references | Context loss | Always reference file paths |
| Huge PRs | Review difficulty | Smaller, phased changes |

---

### Quality Phase (Extended)
```
@tester             ─┬─ Can run together after implementation
@security-auditor   ─┤
@performance-engineer─┘
```
**Why**: Different focus areas, all read-only on code

---

*Collaboration rules for 16-agent system. Last updated: 2025-01-11*
