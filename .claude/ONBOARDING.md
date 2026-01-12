# Onboarding Guide: Claude Code Agent System

> Welcome! This guide will get you productive with our 16-agent development workflow.

---

## What You'll Learn

1. [First 5 Minutes](#first-5-minutes) - Get started immediately
2. [Understanding the System](#understanding-the-system) - How agents work together
3. [Your First Feature](#your-first-feature) - Build something real
4. [Common Scenarios](#common-scenarios) - Daily workflows
5. [Tips & Tricks](#tips--tricks) - Pro tips from the team

---

## First 5 Minutes

### Step 1: Verify Setup

```bash
# Check Claude Code is installed
claude --version

# Navigate to project
cd your-project

# Verify agents exist
ls .claude/agents/
# Should show 16 .md files + 3 underscore files
```

### Step 2: Create Required Directories

```bash
mkdir -p docs/{decisions,plans,research,architecture,test-reports,code-reviews,debug-reports,design-reports,database,security,performance,devops,api,metrics}
```

### Step 3: Start Claude Code

```bash
claude
```

### Step 4: Try Your First Agent

```bash
> "@scout show me the project structure"
```

You should see a structured overview of the codebase.

---

## Understanding the System

### The 16 Agents

Think of agents as specialized team members:

| Phase | Agents | What They Do |
|-------|--------|--------------|
| **Discovery** | @researcher, @scout | Gather information |
| **Decision** | @brainstormer | Choose approach |
| **Architecture** | @architect | Design system |
| **Planning** | @planner | Create implementation plan |
| **Building** | @senior-developer, @database-admin, @devops | Write code |
| **Design** | @ui-ux-designer | Create interfaces |
| **Quality** | @tester, @code-reviewer, @security-auditor, @performance-engineer | Validate |
| **Debug** | @debugger | Fix issues |
| **Finalize** | @docs-manager, @git-manager | Document & commit |

### How Agents Communicate

Agents pass context through **files**, not conversation:

```
@brainstormer → docs/decisions/auth-decision.md
                        ↓
@planner reads → docs/plans/auth-plan.md
                        ↓
@senior-developer reads → implements code
                        ↓
@tester reads → docs/test-reports/auth-tests.md
```

### Key Rule: Reference Files Explicitly

```bash
# ✅ Good - explicit reference
"@planner create plan from docs/decisions/2025-01-11-auth-decision.md"

# ❌ Bad - context may be lost
"@planner create a plan for auth"
```

---

## Your First Feature

Let's build a simple feature together.

### Scenario: Add a User Preferences Feature

#### Step 1: Research (Optional)

```bash
> "@researcher what are best practices for user preferences in Node.js apps"
```
Wait for research report in `docs/research/`.

#### Step 2: Make a Decision

```bash
> "@brainstormer how should we store user preferences? Options: database column, separate table, or JSON field"
```
Creates: `docs/decisions/YYYY-MM-DD-user-preferences-decision.md`

#### Step 3: Create a Plan

```bash
> "@planner create implementation plan from docs/decisions/YYYY-MM-DD-user-preferences-decision.md"
```
Creates: `docs/plans/YYYY-MM-DD-user-preferences-plan.md`

#### Step 4: Implement

```bash
> "@senior-developer implement Phase 1 from docs/plans/YYYY-MM-DD-user-preferences-plan.md"
```

#### Step 5: Test

```bash
> "@tester write and run tests for the user preferences implementation"
```
Creates: `docs/test-reports/YYYY-MM-DD-user-preferences.md`

#### Step 6: Review

```bash
> "@code-reviewer review user preferences from docs/test-reports/YYYY-MM-DD-user-preferences.md"
```
Creates: `docs/code-reviews/YYYY-MM-DD-user-preferences.md`

#### Step 7: Commit

```bash
> "@git-manager commit and push"
```

---

## Common Scenarios

### Quick Bug Fix

```bash
> "@debugger investigate why login fails for special characters in email"
# Creates debug report

> "@senior-developer fix bug from docs/debug-reports/YYYY-MM-DD-login-issue.md"

> "@tester test the login fix"

> "@git-manager commit"
```

### Explore Unknown Code

```bash
> "@scout how does the payment system work?"
> "@scout find all files related to authentication"
> "@scout what patterns are used in this codebase?"
```

### Performance Issue

```bash
> "@performance-engineer analyze slow /api/orders endpoint"
# Creates performance report

> "@senior-developer implement optimizations from docs/performance/YYYY-MM-DD-orders.md"
```

### Security Audit

```bash
> "@security-auditor audit the authentication module"
# Creates security report

> "@senior-developer fix critical issues from docs/security/YYYY-MM-DD-auth-audit.md"
```

### Database Change

```bash
> "@database-admin design schema for user notifications"
# Creates migration plan

> "@senior-developer create migration from docs/database/YYYY-MM-DD-notifications.md"
```

---

## Tips & Tricks

### 1. Use `/clear` Between Tasks

```bash
# After finishing a feature
> /clear

# Start fresh
> "New task: add password reset"
```

### 2. Deep Thinking Triggers

```bash
> "think about edge cases in this implementation"
> "think hard about the security implications"
> "ultrathink about the architecture"
```

### 3. Check What Documents Exist

```bash
> "@scout list recent documents in docs/"
```

### 4. When Stuck

```bash
# Check error recovery patterns
> "Read .claude/agents/_error-recovery.md"

# Ask for help
> "@brainstormer I'm stuck on X, help me think through options"
```

### 5. Parallel Agents

Some agents can run together:
- @researcher + @scout (both gather info)
- @tester + @security-auditor (both validate)

### 6. Skip Agents When Appropriate

- Small bug fix? Skip @brainstormer, @planner
- Obvious change? Skip @architect
- Simple feature? Skip @researcher

---

## Workflow Templates

Quick-start templates are in `.claude/templates/`:

| Template | Use When |
|----------|----------|
| `new-feature.md` | Building new functionality |
| `bug-fix.md` | Fixing issues |
| `refactor.md` | Improving code structure |
| `security-fix.md` | Addressing vulnerabilities |
| `release-checklist.md` | Preparing for deployment |

Example:

```bash
> "Follow the workflow in .claude/templates/new-feature.md for adding email notifications"
```

---

## Key Documents to Know

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Project configuration and commands |
| `GUIDE.md` | Full agent reference |
| `HANDOFF.md` | How agents pass context |
| `.claude/agents/_collaboration.md` | Agent dependencies |
| `.claude/agents/_error-recovery.md` | When things go wrong |
| `.claude/project.config.md` | Project-specific settings |

---

## Troubleshooting

### "Agent doesn't have context"

Always reference files:
```bash
"@planner create plan from docs/decisions/specific-file.md"
```

### "Agent output not saved"

Check output location in agent definition:
```bash
cat .claude/agents/[agent].md | head -25
```

### "Workflow stalled"

Check collaboration rules:
```bash
cat .claude/agents/_collaboration.md
```

### "Not sure which agent to use"

Ask:
```bash
> "Which agent should I use to [describe task]?"
```

---

## Getting Help

1. **In-session**: Type `/help`
2. **Agent guide**: Read `GUIDE.md`
3. **Collaboration rules**: Read `.claude/agents/_collaboration.md`
4. **Error recovery**: Read `.claude/agents/_error-recovery.md`

---

## Checklist: Am I Ready?

- [ ] Claude Code installed and working
- [ ] Project structure understood
- [ ] Docs directories created
- [ ] Completed first @scout query
- [ ] Know how to reference files in prompts
- [ ] Know when to use /clear
- [ ] Know the main agent workflows

---

## Next Steps

1. **Read** `GUIDE.md` for complete reference
2. **Try** each agent on a small task
3. **Review** the workflow templates
4. **Track** your first feature with a session log

---

*Welcome to the team! Last updated: 2025-01-11*
