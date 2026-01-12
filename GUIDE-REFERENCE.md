# Agent Reference Guide

> Complete reference for all 16 agents, commands, and output locations

---

## Table of Contents

1. [All Agents Overview](#all-agents-overview)
2. [Agent Selection Flowchart](#agent-selection-flowchart)
3. [Invoking Agents](#invoking-agents)
4. [Command Quick Reference](#command-quick-reference)
5. [Output Locations](#output-locations)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## All Agents Overview

### The 16 Agents

| Agent | Purpose | Model | Output Location |
|-------|---------|-------|-----------------|
| `@brainstormer` | Explore solutions, decide approach | sonnet | `docs/decisions/` |
| `@architect` | Design system architecture | sonnet | `docs/architecture/` |
| `@planner` | Create implementation plans | sonnet | `docs/plans/` |
| `@researcher` | Research tech, best practices | sonnet | `docs/research/` |
| `@scout` | Explore codebase, find files | haiku | Chat |
| `@senior-developer` | Write production code | sonnet | Source files |
| `@tester` | Write/run tests, coverage | sonnet | `docs/test-reports/` |
| `@code-reviewer` | Review quality, security | sonnet | `docs/code-reviews/` |
| `@debugger` | Investigate bugs, root cause | sonnet | `docs/debug-reports/` |
| `@ui-ux-designer` | Design interfaces, components | sonnet | `docs/design-reports/` |
| `@database-admin` | Schema, migrations, queries | sonnet | `docs/database/` |
| `@security-auditor` | Security vulnerabilities | sonnet | `docs/security/` |
| `@performance-engineer` | Performance optimization | sonnet | `docs/performance/` |
| `@devops` | CI/CD, Docker, deployment | sonnet | `docs/devops/` |
| `@docs-manager` | README, API docs, changelog | sonnet | `docs/`, `README.md` |
| `@git-manager` | Commits, branches, PRs | haiku | Git |

### Agent Categories

**Discovery & Planning**
- `@brainstormer` - Decisions and trade-offs
- `@architect` - System design
- `@researcher` - Technology research
- `@planner` - Implementation breakdown
- `@scout` - Codebase exploration

**Implementation**
- `@senior-developer` - Code writing
- `@ui-ux-designer` - Interface design
- `@database-admin` - Database operations

**Quality & Review**
- `@tester` - Testing and coverage
- `@code-reviewer` - Code quality
- `@security-auditor` - Security analysis
- `@performance-engineer` - Performance optimization
- `@debugger` - Bug investigation

**Operations**
- `@docs-manager` - Documentation
- `@devops` - CI/CD and infrastructure
- `@git-manager` - Version control

---

## Agent Selection Flowchart

```
What do you need?
│
├─ "I don't know how to approach this"
│   └── @brainstormer
│
├─ "How should we structure this system?"
│   └── @architect
│
├─ "What's the best library/approach?"
│   └── @researcher
│
├─ "I need a plan for this feature"
│   └── @planner
│
├─ "Where is the code for X?"
│   └── @scout
│
├─ "Build this feature"
│   └── @senior-developer
│
├─ "Design a UI component"
│   └── @ui-ux-designer
│
├─ "I need database changes"
│   └── @database-admin
│
├─ "Write tests / check coverage"
│   └── @tester
│
├─ "Review my code"
│   └── @code-reviewer
│
├─ "Check for security issues"
│   └── @security-auditor
│
├─ "This endpoint is slow"
│   └── @performance-engineer
│
├─ "Something is broken"
│   └── @debugger
│
├─ "Update documentation"
│   └── @docs-manager
│
├─ "Setup CI/CD or Docker"
│   └── @devops
│
└─ "Commit / push / create PR"
    └── @git-manager
```

---

## Invoking Agents

### Method 1: @ Mention (Recommended)

```bash
> "@brainstormer explore options for implementing caching"
> "@planner create plan for user authentication"
> "@scout find all files related to payments"
> "@senior-developer implement the login endpoint"
> "@tester write tests for the auth module"
```

### Method 2: Keyword Triggers

| Keywords | Agent |
|----------|-------|
| "brainstorm", "explore options", "trade-offs", "should we" | `@brainstormer` |
| "architecture", "design system", "structure" | `@architect` |
| "plan", "break down", "implementation steps" | `@planner` |
| "research", "best practices", "compare", "what's the best" | `@researcher` |
| "find", "where is", "show me", "locate" | `@scout` |
| "implement", "build", "code", "create", "fix" | `@senior-developer` |
| "test", "coverage", "write tests" | `@tester` |
| "review", "check code", "before merge" | `@code-reviewer` |
| "security", "vulnerabilities", "audit" | `@security-auditor` |
| "debug", "investigate", "why is it broken" | `@debugger` |
| "design", "UI", "wireframe", "component design" | `@ui-ux-designer` |
| "database", "schema", "migration", "query" | `@database-admin` |
| "performance", "slow", "optimize", "profile" | `@performance-engineer` |
| "documentation", "README", "changelog", "API docs" | `@docs-manager` |
| "CI/CD", "Docker", "deploy", "pipeline" | `@devops` |
| "commit", "push", "PR", "branch" | `@git-manager` |

### Method 3: Chain Multiple Agents

```bash
> "For the user authentication feature:
   1. @brainstormer explore JWT vs sessions
   2. @planner create implementation plan
   3. @senior-developer implement it
   4. @tester write tests
   5. @code-reviewer review
   6. @git-manager create PR"
```

---

## Command Quick Reference

### Planning & Research

```bash
> "@brainstormer should we use X or Y?"
> "@brainstormer explore options for [feature]"
> "@architect design architecture from docs/decisions/..."
> "@researcher best practices for [topic]"
> "@researcher compare [A] vs [B] for [use case]"
> "@planner create plan for [feature]"
> "@planner create plan from docs/decisions/..."
> "@scout find files related to [feature]"
> "@scout where is [component/function]?"
```

### Development

```bash
> "@senior-developer implement [feature]"
> "@senior-developer implement Phase 1 from docs/plans/..."
> "@senior-developer fix issues from docs/code-reviews/..."
> "@ui-ux-designer design [component]"
> "@database-admin create migration for [change]"
> "@database-admin optimize query: [query]"
```

### Quality

```bash
> "@tester write tests for [module]"
> "@tester run tests and report coverage"
> "@tester check coverage for [module]"
> "@code-reviewer review my changes"
> "@code-reviewer review [feature]. Test report: docs/test-reports/..."
> "@security-auditor audit [module]"
> "@security-auditor run npm audit"
> "@performance-engineer analyze [endpoint]"
> "@performance-engineer profile [operation]"
```

### Debugging

```bash
> "@debugger why is [X] failing?"
> "@debugger investigate [bug description]"
> "@debugger analyze error: [paste error]"
> "@debugger trace the flow of [operation]"
```

### Documentation

```bash
> "@docs-manager update README for [feature]"
> "@docs-manager update changelog for version [X.Y.Z]"
> "@docs-manager generate API docs for [endpoints]"
> "@docs-manager sync all documentation"
```

### DevOps

```bash
> "@devops setup CI/CD pipeline"
> "@devops create Docker configuration"
> "@devops setup GitHub Actions with test, build, deploy"
> "@devops create environment configuration"
```

### Git

```bash
> "@git-manager commit"
> "@git-manager commit with message 'type(scope): description'"
> "@git-manager commit and push"
> "@git-manager create branch feat/[name]"
> "@git-manager create PR for [feature]"
> "@git-manager sync with main"
```

---

## Output Locations

### File Naming Convention

```
docs/[type]/YYYY-MM-DD-[topic]-[type].md
```

### Agent Output Mapping

| Agent | Location | Example |
|-------|----------|---------|
| `@brainstormer` | `docs/decisions/` | `2025-01-11-auth-decision.md` |
| `@architect` | `docs/architecture/` | `2025-01-11-auth-architecture.md` |
| `@planner` | `docs/plans/` | `2025-01-11-auth-plan.md` |
| `@researcher` | `docs/research/` | `2025-01-11-jwt-best-practices.md` |
| `@tester` | `docs/test-reports/` | `2025-01-11-auth.md` |
| `@code-reviewer` | `docs/code-reviews/` | `2025-01-11-auth.md` |
| `@debugger` | `docs/debug-reports/` | `2025-01-11-login-500-error.md` |
| `@ui-ux-designer` | `docs/design-reports/` | `2025-01-11-login-form.md` |
| `@database-admin` | `docs/database/` | `2025-01-11-users-migration.md` |
| `@security-auditor` | `docs/security/` | `2025-01-11-security-audit.md` |
| `@performance-engineer` | `docs/performance/` | `2025-01-11-api-performance.md` |
| `@devops` | `docs/devops/` | `2025-01-11-ci-setup.md` |
| `@docs-manager` | `README.md`, `docs/api/` | Various |
| `@git-manager` | Git | Commits, branches, PRs |
| `@scout` | Chat | Information only |
| `@senior-developer` | `src/` | Source files |

### Directory Structure

```
docs/
├── decisions/          # @brainstormer
├── architecture/       # @architect
├── plans/              # @planner
├── research/           # @researcher
├── test-reports/       # @tester
├── code-reviews/       # @code-reviewer
├── debug-reports/      # @debugger
├── design-reports/     # @ui-ux-designer
├── database/           # @database-admin
├── security/           # @security-auditor
├── performance/        # @performance-engineer
├── devops/             # @devops
├── api/                # @docs-manager
└── metrics/            # Session logs
```

---

## Best Practices

### 1. Clear Context Between Tasks

```bash
# DO: Clear between unrelated tasks
> /clear
> "Start working on payment feature"

# DON'T: Mix unrelated tasks
> "Fix login bug and also add dashboard"
```

### 2. Use the Right Agent

```bash
# DO: Match agent to task
> "@debugger investigate the error"      # Investigation
> "@senior-developer fix the bug"        # Implementation

# DON'T: Wrong agent for task
> "@tester fix this bug"                 # Testers test, not fix
> "@brainstormer write the code"         # Brainstormers advise
```

### 3. Work Incrementally

```bash
# DO: Small steps
> "@senior-developer implement user model"
> "@tester test user model"
> "@senior-developer implement user service"
> "@tester test user service"

# DON'T: Everything at once
> "@senior-developer implement entire user system"
```

### 4. Always Reference Files

```bash
# DO: Reference output files
> "@planner create plan from docs/decisions/2025-01-11-auth-decision.md"

# DON'T: Rely on context memory
> "@planner create a plan"
```

### 5. Test After Every Change

```bash
# DO: Test continuously
> "@senior-developer implement feature"
> "@tester run tests"                    # Always!

# DON'T: Skip testing
> "@senior-developer implement feature"
> "@git-manager commit"                  # No tests!
```

### 6. Review Before Merge

```bash
# DO: Always review
> "@code-reviewer review before merge"
> "@git-manager create PR"

# DON'T: Push directly
> "@git-manager push to main"            # No review!
```

### 7. Be Specific

```bash
# DO: Detailed requirements
> "@senior-developer implement password reset with:
   - Email verification
   - Expiring tokens (1 hour)
   - Rate limiting (3 attempts)
   - Audit logging"

# DON'T: Vague requests
> "@senior-developer add password reset"
```

### 8. Use Scout First

```bash
# DO: Understand before changing
> "@scout how is auth implemented?"
> "@senior-developer add MFA to existing auth"

# DON'T: Change without understanding
> "@senior-developer add MFA"            # May conflict!
```

---

## Troubleshooting

### Agent Not Responding as Expected

```bash
# Be more explicit
> "Use @brainstormer agent to explore options for X"

# Or more specific
> "@brainstormer I need you to:
   1. Analyze option A
   2. Analyze option B
   3. Compare them
   4. Recommend one
   5. Save to docs/decisions/"
```

### Context Getting Confused

```bash
# Clear and restart
> /clear
> "Starting fresh. Working on [feature].
   Decision: docs/decisions/...
   Plan: docs/plans/..."
```

### Agent Doing Wrong Task

```bash
# Stop and redirect
> "Stop. That's not what I need.
   @[correct-agent] please [correct task]"
```

### Files Not Being Created

```bash
# Explicitly request file output
> "@brainstormer explore options and save decision document to docs/decisions/"
```

### Handoff Not Working

```bash
# Manual file reference
> "@planner read docs/decisions/2025-01-11-auth-decision.md and create plan"
```

### Too Many Tool Calls

```bash
# Be more specific upfront
> "@senior-developer implement login endpoint:
   - Use existing User model at src/models/user.ts
   - Follow pattern in src/services/auth.service.ts
   - Add to router at src/api/routes.ts
   - Use bcrypt for passwords, JWT for tokens"
```

### Context Lost Between Sessions

```bash
# Restore with file references
> "Continue auth implementation.
   Decision: docs/decisions/2025-01-11-auth-decision.md
   Plan: docs/plans/2025-01-11-auth-plan.md
   Progress: Phase 2 complete, starting Phase 3"
```

---

## Summary Table

| I want to... | Agent | Command |
|--------------|-------|---------|
| Decide approach | `@brainstormer` | `"@brainstormer explore options for X"` |
| Design architecture | `@architect` | `"@architect design architecture from docs/decisions/..."` |
| Research tech | `@researcher` | `"@researcher best practices for X"` |
| Create plan | `@planner` | `"@planner create plan from docs/architecture/..."` |
| Find code | `@scout` | `"@scout find files related to X"` |
| Build feature | `@senior-developer` | `"@senior-developer implement X"` |
| Design UI | `@ui-ux-designer` | `"@ui-ux-designer design X component"` |
| Database work | `@database-admin` | `"@database-admin create migration for X"` |
| Write tests | `@tester` | `"@tester write tests for X"` |
| Review code | `@code-reviewer` | `"@code-reviewer review X"` |
| Security check | `@security-auditor` | `"@security-auditor audit X"` |
| Optimize performance | `@performance-engineer` | `"@performance-engineer analyze X"` |
| Debug issue | `@debugger` | `"@debugger investigate X"` |
| Update docs | `@docs-manager` | `"@docs-manager update README"` |
| Setup CI/CD | `@devops` | `"@devops setup GitHub Actions"` |
| Git operations | `@git-manager` | `"@git-manager commit and create PR"` |
| Clear context | `/clear` | `/clear` |

---

*Reference guide for 16-agent system. Last updated: 2025-01-11*
