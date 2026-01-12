# Quick Start Guide

> Get started with the 16-agent workflow system in 5 minutes

---

## First Time Setup

```bash
# 1. Navigate to your project
cd your-project

# 2. Verify agents exist
ls .claude/agents/
# Should show 16 agent .md files + 3 system files

# 3. Create docs directories (if not exist)
mkdir -p docs/{decisions,plans,research,architecture,test-reports,code-reviews,debug-reports,design-reports,database,security,performance,devops,api,metrics}

# 4. Start Claude Code
claude

# 5. Test an agent
> "@scout show me the project structure"
```

---

## Essential Commands

### CLI Commands

```bash
claude                    # Interactive mode
claude "your prompt"      # Single command
claude -p "prompt"        # Headless mode (scripts)
```

### In-Session Commands

| Command | Action |
|---------|--------|
| `/clear` | Clear context (use between tasks!) |
| `/help` | Show commands |
| `Escape` | Stop current operation |
| `Escape` + `Escape` | Edit previous prompt |

### Deep Thinking

```bash
> "think about how to implement auth"           # Basic
> "think hard about the architecture"           # Deeper
> "think harder about edge cases"               # Even deeper
> "ultrathink about security implications"      # Maximum depth
```

---

## Agent Quick Reference

### Which Agent Do I Need?

| I want to... | Use | Command |
|--------------|-----|---------|
| Decide approach | `@brainstormer` | `"@brainstormer explore options for X"` |
| Design system | `@architect` | `"@architect design architecture for X"` |
| Research tech | `@researcher` | `"@researcher best practices for X"` |
| Create plan | `@planner` | `"@planner create plan from docs/..."` |
| Find code | `@scout` | `"@scout find files related to X"` |
| Build feature | `@senior-developer` | `"@senior-developer implement X"` |
| Design UI | `@ui-ux-designer` | `"@ui-ux-designer design X"` |
| Database work | `@database-admin` | `"@database-admin create migration"` |
| Write tests | `@tester` | `"@tester write tests for X"` |
| Review code | `@code-reviewer` | `"@code-reviewer review X"` |
| Security check | `@security-auditor` | `"@security-auditor audit X"` |
| Fix performance | `@performance-engineer` | `"@performance-engineer analyze X"` |
| Debug issue | `@debugger` | `"@debugger investigate X"` |
| Update docs | `@docs-manager` | `"@docs-manager update README"` |
| Setup CI/CD | `@devops` | `"@devops setup GitHub Actions"` |
| Git operations | `@git-manager` | `"@git-manager commit and PR"` |

---

## Common Workflows (Copy-Paste)

### New Feature (Quick)

```bash
> "@planner quick plan for [feature]"
> "@senior-developer implement [feature]"
> "@tester test [feature]"
> "@git-manager commit [feature]"
```

### Bug Fix

```bash
> "@debugger investigate [bug description]"
> "@senior-developer fix bug from docs/debug-reports/..."
> "@tester write regression test"
> "@git-manager commit fix"
```

### Code Review & Merge

```bash
> "@tester run all tests"
> "@code-reviewer review changes"
> "@git-manager create PR"
```

---

## Golden Rules

1. **Use `/clear` between unrelated tasks**
2. **Always reference file paths explicitly**
3. **Test after every change**
4. **Review before merge**
5. **Work incrementally, not all at once**

---

## Handoff Basics

Agents save outputs to files. Reference them explicitly:

```bash
# Step 1: Brainstorm
> "@brainstormer explore auth options"
# Output: docs/decisions/2025-01-11-auth-decision.md

# Step 2: Plan (reference the file!)
> "@planner create plan from docs/decisions/2025-01-11-auth-decision.md"
# Output: docs/plans/2025-01-11-auth-plan.md

# Step 3: Implement (reference the file!)
> "@senior-developer implement Phase 1 from docs/plans/2025-01-11-auth-plan.md"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Context confused | `/clear` and restart with file references |
| Agent wrong task | Stop, use `@correct-agent` explicitly |
| Files not created | Explicitly ask to "save to docs/..." |
| Handoff broken | Reference file path directly |

---

## Next Steps

- **[GUIDE-WORKFLOWS.md](GUIDE-WORKFLOWS.md)** - Detailed workflow patterns
- **[GUIDE-REFERENCE.md](GUIDE-REFERENCE.md)** - Complete agent reference
- **[HANDOFF.md](HANDOFF.md)** - How agents share context

---

*Quick start for 16-agent system. Last updated: 2025-01-11*
