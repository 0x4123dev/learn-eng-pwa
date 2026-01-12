# Claude Code CLI Agent System Guide

> Complete guide for using the 16-agent workflow system with Claude Code CLI

---

## Documentation Overview

This guide has been split into focused sections for easier navigation:

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| **[GUIDE-QUICKSTART.md](GUIDE-QUICKSTART.md)** | Get started in 5 minutes | New users, quick reference |
| **[GUIDE-WORKFLOWS.md](GUIDE-WORKFLOWS.md)** | Detailed workflow patterns | Building features, fixing bugs |
| **[GUIDE-REFERENCE.md](GUIDE-REFERENCE.md)** | Complete agent reference | Looking up commands, agents |
| **[HANDOFF.md](HANDOFF.md)** | Agent context passing | Understanding file handoffs |

---

## Quick Start

### First Time Setup

```bash
# 1. Navigate to your project
cd your-project

# 2. Verify agents exist
ls .claude/agents/
# Should show 16 agent .md files + 3 system files

# 3. Create docs directories
mkdir -p docs/{decisions,plans,research,architecture,test-reports,code-reviews,debug-reports,design-reports,database,security,performance,devops,api,metrics}

# 4. Start Claude Code
claude

# 5. Test an agent
> "@scout show me the project structure"
```

### Essential Commands

```bash
claude                    # Interactive mode
/clear                    # Clear context (use between tasks!)
/help                     # Show commands
```

---

## The 16 Agents

| Agent | Purpose | Output |
|-------|---------|--------|
| `@brainstormer` | Decisions & trade-offs | `docs/decisions/` |
| `@architect` | System design | `docs/architecture/` |
| `@planner` | Implementation plans | `docs/plans/` |
| `@researcher` | Tech research | `docs/research/` |
| `@scout` | Codebase exploration | Chat |
| `@senior-developer` | Code writing | Source files |
| `@tester` | Testing & coverage | `docs/test-reports/` |
| `@code-reviewer` | Code quality | `docs/code-reviews/` |
| `@debugger` | Bug investigation | `docs/debug-reports/` |
| `@ui-ux-designer` | Interface design | `docs/design-reports/` |
| `@database-admin` | Database ops | `docs/database/` |
| `@security-auditor` | Security analysis | `docs/security/` |
| `@performance-engineer` | Performance | `docs/performance/` |
| `@devops` | CI/CD & infra | `docs/devops/` |
| `@docs-manager` | Documentation | `docs/`, `README.md` |
| `@git-manager` | Git operations | Git |

---

## Common Workflows

### New Feature

```bash
> "@brainstormer explore options for [feature]"
> "@planner create plan from docs/decisions/..."
> "@senior-developer implement Phase 1 from docs/plans/..."
> "@tester write tests for [feature]"
> "@code-reviewer review [feature]"
> "@git-manager commit and create PR"
```

### Bug Fix

```bash
> "@debugger investigate [bug]"
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

## Workflow Cheat Sheet

| Scenario | Workflow |
|----------|----------|
| New Feature (Full) | `@brainstormer → @architect → @planner → @senior-developer → @tester → @code-reviewer → @git-manager` |
| New Feature (Quick) | `@planner → @senior-developer → @tester → @git-manager` |
| Bug Fix | `@debugger → @senior-developer → @tester → @git-manager` |
| Refactor | `@scout → @tester → @planner → @senior-developer → @tester → @git-manager` |
| Security Fix | `@security-auditor → @senior-developer → @tester → @git-manager` |
| Database Change | `@brainstormer → @database-admin → @senior-developer → @tester → @git-manager` |
| UI Component | `@researcher → @ui-ux-designer → @senior-developer → @tester → @git-manager` |

---

## Golden Rules

1. **Use `/clear` between unrelated tasks** - Prevents context confusion
2. **Always reference file paths explicitly** - Don't rely on memory
3. **Test after every change** - Run `@tester` frequently
4. **Review before merge** - Always use `@code-reviewer`
5. **Work incrementally** - Small steps, not everything at once

---

## Agent Selection

```
What do you need?
├─ Don't know approach → @brainstormer
├─ System design → @architect
├─ Best practices → @researcher
├─ Implementation plan → @planner
├─ Find code → @scout
├─ Build feature → @senior-developer
├─ Design UI → @ui-ux-designer
├─ Database work → @database-admin
├─ Write tests → @tester
├─ Review code → @code-reviewer
├─ Security check → @security-auditor
├─ Performance → @performance-engineer
├─ Debug issue → @debugger
├─ Update docs → @docs-manager
├─ CI/CD setup → @devops
└─ Git operations → @git-manager
```

---

## Handoff System

Agents save outputs to files. Reference them explicitly:

```bash
# Brainstorm saves decision
> "@brainstormer explore auth options"
# Output: docs/decisions/2025-01-11-auth-decision.md

# Planner reads decision, creates plan
> "@planner create plan from docs/decisions/2025-01-11-auth-decision.md"
# Output: docs/plans/2025-01-11-auth-plan.md

# Developer reads plan, implements
> "@senior-developer implement Phase 1 from docs/plans/2025-01-11-auth-plan.md"
```

**See [HANDOFF.md](HANDOFF.md) for detailed handoff documentation.**

---

## Detailed Guides

### Quick Start & Essentials
**[GUIDE-QUICKSTART.md](GUIDE-QUICKSTART.md)**
- First time setup
- Essential commands
- Agent quick reference
- Common workflows (copy-paste)
- Golden rules
- Troubleshooting basics

### Workflow Patterns
**[GUIDE-WORKFLOWS.md](GUIDE-WORKFLOWS.md)**
- New feature (full & quick)
- Bug fix workflow
- Refactoring workflow
- UI component workflow
- Database changes
- Security audit
- DevOps setup
- Documentation updates
- Pre-release review
- Real-world examples

### Complete Reference
**[GUIDE-REFERENCE.md](GUIDE-REFERENCE.md)**
- All 16 agents detailed
- Agent selection flowchart
- Invocation methods
- Complete command reference
- Output locations
- Best practices
- Troubleshooting guide

### Handoff System
**[HANDOFF.md](HANDOFF.md)**
- How agents share context
- File locations
- Handoff chain diagram
- Complete example flow
- Troubleshooting handoffs

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Project instructions & standards |
| [.claude/ONBOARDING.md](.claude/ONBOARDING.md) | New team member guide |
| [.claude/CONTRIBUTING.md](.claude/CONTRIBUTING.md) | How to modify agents |
| [.claude/agents/_collaboration.md](.claude/agents/_collaboration.md) | Agent dependencies |
| [.claude/agents/_error-recovery.md](.claude/agents/_error-recovery.md) | Error handling |

---

## Validation

Before committing, validate your handoff chain:

```bash
# Run handoff validation
.claude/scripts/validate-handoff.sh [feature-name]
```

---

*Hub guide for 16-agent system. Last updated: 2025-01-11*
