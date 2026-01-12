# Workflow Patterns Guide

> Detailed workflows for common development scenarios

---

## Table of Contents

1. [New Feature (Full)](#workflow-1-new-feature-full)
2. [New Feature (Quick)](#workflow-2-new-feature-quick)
3. [Feature in Existing Project](#workflow-3-feature-in-existing-project)
4. [Bug Fix](#workflow-4-bug-fix)
5. [Refactoring](#workflow-5-refactoring)
6. [UI Component](#workflow-6-ui-component)
7. [Database Changes](#workflow-7-database-changes)
8. [Security Audit](#workflow-8-security-audit)
9. [DevOps Setup](#workflow-9-devops-setup)
10. [Documentation](#workflow-10-documentation)
11. [Pre-Release Review](#workflow-11-pre-release-review)
12. [Research & Learning](#workflow-12-research--learning)
13. [Codebase Exploration](#workflow-13-codebase-exploration)

---

## Workflow 1: New Feature (Full)

**When**: Complex features requiring decisions and architecture

**Chain**:
```
@brainstormer → @architect → @planner → @senior-developer → @tester → @code-reviewer → @docs-manager → @git-manager
```

**Steps**:

```bash
# Step 1: Explore approaches
> "@brainstormer explore options for [feature]. Consider our tech stack and team skills."
# Output: docs/decisions/2025-01-11-[feature]-decision.md

# Step 2: Design architecture (complex features)
> "@architect design architecture from docs/decisions/2025-01-11-[feature]-decision.md"
# Output: docs/architecture/2025-01-11-[feature]-architecture.md

# Step 3: Create plan
> "@planner create plan from docs/architecture/2025-01-11-[feature]-architecture.md"
# Output: docs/plans/2025-01-11-[feature]-plan.md

# Step 4: Research (if needed)
> "@researcher find best practices for [specific tech]"
# Output: docs/research/2025-01-11-[topic].md

# Step 5: Implement phase by phase
> "@senior-developer implement Phase 1 from docs/plans/2025-01-11-[feature]-plan.md"
# Repeat for each phase

# Step 6: Test
> "@tester write tests for [feature] based on docs/plans/2025-01-11-[feature]-plan.md"
# Output: docs/test-reports/2025-01-11-[feature].md

# Step 7: Review
> "@code-reviewer review [feature]. Test report: docs/test-reports/2025-01-11-[feature].md"
# Output: docs/code-reviews/2025-01-11-[feature].md

# Step 8: Fix review issues (if any)
> "@senior-developer fix issues from docs/code-reviews/2025-01-11-[feature].md"

# Step 9: Update docs
> "@docs-manager update README and changelog for [feature]"

# Step 10: Commit and PR
> "@git-manager commit and create PR for [feature]"
```

**Checklist**:
- [ ] Decision documented
- [ ] Architecture designed (if complex)
- [ ] Plan created and followed
- [ ] All phases implemented
- [ ] Tests written (≥80% coverage)
- [ ] Code review approved
- [ ] Documentation updated
- [ ] PR created

---

## Workflow 2: New Feature (Quick)

**When**: Simple, well-understood features

**Chain**:
```
@planner → @senior-developer → @tester → @git-manager
```

**Steps**:

```bash
> "@planner quick plan for [feature]"
> "@senior-developer implement [feature]"
> "@tester test [feature]"
> "@code-reviewer quick review"
> "@git-manager commit [feature]"
```

---

## Workflow 3: Feature in Existing Project

**When**: Adding features to an unfamiliar codebase that needs exploration first

**Chain**:
```
@scout → @researcher → @brainstormer → @planner → @senior-developer → @tester → @code-reviewer → @git-manager
```

**Steps**:

```bash
# Step 1: Explore the codebase
> "@scout explore this project - show structure, tech stack, patterns, and conventions"

# Step 2: Find related code
> "@scout find files related to [feature-area]. Show how similar features work."

# Step 3: Understand patterns
> "@researcher analyze patterns in this codebase:
  - How are services structured?
  - How is data accessed?
  - How are APIs defined?
  - What testing approach is used?"

# Step 4: Decide approach following existing patterns
> "@brainstormer decide approach for [feature]:
  Following patterns found:
  - [list discovered patterns]
  Integration points:
  - [list where to connect]"
# Output: docs/decisions/2025-01-11-[feature]-decision.md

# Step 5: Create plan respecting architecture
> "@planner create plan from docs/decisions/2025-01-11-[feature]-decision.md
  Follow existing code conventions and patterns."
# Output: docs/plans/2025-01-11-[feature]-plan.md

# Step 6: Implement matching existing style
> "@senior-developer implement Phase 1 from docs/plans/2025-01-11-[feature]-plan.md
  Match existing code style and use established patterns."

# Step 7: Test following existing conventions
> "@tester write tests for [feature] using project's test patterns"
# Output: docs/test-reports/2025-01-11-[feature].md

# Step 8: Review for consistency
> "@code-reviewer review [feature]:
  - Does it follow established patterns?
  - Is naming consistent with codebase?
  - Does it reuse existing utilities?"
# Output: docs/code-reviews/2025-01-11-[feature].md

# Step 9: Commit
> "@git-manager commit and create PR for [feature]"
```

**Checklist**:
- [ ] Codebase explored and understood
- [ ] Existing patterns identified
- [ ] Integration points mapped
- [ ] Decision follows codebase conventions
- [ ] Implementation matches code style
- [ ] Tests follow existing patterns
- [ ] Review confirms consistency

**Template**: `.claude/templates/existing-project-feature.md`

---

## Workflow 4: Bug Fix

**When**: Something is broken

**Chain**:
```
@debugger → @senior-developer → @tester → @code-reviewer → @git-manager
```

**Steps**:

```bash
# Step 1: Investigate
> "@debugger investigate why [describe bug]. Check logs and trace the issue."
# Output: docs/debug-reports/2025-01-11-[issue].md

# Step 2: Fix
> "@senior-developer fix bug from docs/debug-reports/2025-01-11-[issue].md"

# Step 3: Add regression test
> "@tester write regression test for [bug]"

# Step 4: Quick review
> "@code-reviewer review the bug fix"

# Step 5: Commit with issue reference
> "@git-manager commit with message 'fix(scope): description' refs #[issue]"
```

**Quick Version**:
```bash
> "@debugger find and explain the bug in [location]"
> "@senior-developer fix it and add a test"
> "@git-manager commit the fix"
```

---

## Workflow 5: Refactoring

**When**: Improving code without changing behavior

**Chain**:
```
@scout → @tester (ensure coverage) → @planner → @senior-developer → @tester → @git-manager
```

**Steps**:

```bash
# Step 1: Understand current code
> "@scout analyze [module] structure and patterns"

# Step 2: Ensure tests exist first
> "@tester check coverage for [module]. Write tests for untested code."

# Step 3: Plan refactor
> "@planner create refactoring plan for [module]. Keep changes atomic."
# Output: docs/plans/2025-01-11-refactor-[module]-plan.md

# Step 4: Refactor incrementally
> "@senior-developer refactor step 1 from docs/plans/..."
> "@tester run tests"  # After each step!
> "@senior-developer refactor step 2..."
# Repeat until done

# Step 5: Final review
> "@code-reviewer review refactoring"

# Step 6: Commit
> "@git-manager commit with message 'refactor(module): description'"
```

**Rules**:
- Run tests after every change
- Commit after each refactor step
- Never refactor + add features together

---

## Workflow 6: UI Component

**When**: Creating user interfaces

**Chain**:
```
@researcher → @ui-ux-designer → @senior-developer → @tester → @code-reviewer → @git-manager
```

**Steps**:

```bash
# Step 1: Research patterns
> "@researcher find UI patterns for [component]. Check accessibility guidelines."
# Output: docs/research/2025-01-11-[component]-patterns.md

# Step 2: Design
> "@ui-ux-designer design [component]. Mobile-first, accessible, follow design system."
# Output: docs/design-reports/2025-01-11-[component].md

# Step 3: Implement
> "@senior-developer implement [component] from docs/design-reports/2025-01-11-[component].md"

# Step 4: Test
> "@tester test [component] responsiveness and accessibility"

# Step 5: Review
> "@code-reviewer review [component]"

# Step 6: Commit
> "@git-manager commit [component]"
```

---

## Workflow 7: Database Changes

**When**: Schema changes, migrations, query optimization

**Chain**:
```
@brainstormer → @database-admin → @senior-developer → @tester → @code-reviewer → @git-manager
```

**Steps**:

```bash
# Step 1: Design schema (if complex)
> "@brainstormer design schema for [feature]. Consider relationships and future needs."
# Output: docs/decisions/2025-01-11-[feature]-schema-decision.md

# Step 2: Create migration plan
> "@database-admin create migration from docs/decisions/2025-01-11-[feature]-schema-decision.md"
# Output: docs/database/2025-01-11-[change]-migration.md

# Step 3: Implement migration
> "@senior-developer create migration from docs/database/2025-01-11-[change]-migration.md"

# Step 4: Test migration
> "@tester test migration: apply, verify, rollback, re-apply"

# Step 5: Review
> "@code-reviewer review migration for safety"

# Step 6: Commit
> "@git-manager commit migration"
```

**Query Optimization**:
```bash
> "@database-admin analyze and optimize slow query: [paste query]"
```

---

## Workflow 8: Security Audit

**When**: Before release, after security concerns, regular audits

**Chain**:
```
@security-auditor → @senior-developer → @tester → @security-auditor → @git-manager
```

**Steps**:

```bash
# Step 1: Full audit
> "@security-auditor audit the entire codebase. Check OWASP Top 10."
# Output: docs/security/2025-01-11-security-audit.md

# Step 2: Fix critical/high issues
> "@senior-developer fix critical issues from docs/security/2025-01-11-security-audit.md"

# Step 3: Verify fixes
> "@tester verify security fixes"

# Step 4: Re-audit
> "@security-auditor verify fixes from previous audit"

# Step 5: Commit
> "@git-manager commit security fixes"
```

**Quick Check**:
```bash
> "@security-auditor check [module] for vulnerabilities"
> "@security-auditor run npm audit and report"
```

---

## Workflow 9: DevOps Setup

**When**: New project, adding CI/CD, containerization

**Chain**:
```
@devops → @tester → @git-manager
```

**Steps**:

```bash
# CI/CD Pipeline
> "@devops setup GitHub Actions CI/CD with test, build, and deploy stages"
# Output: .github/workflows/pipeline.yml + docs/devops/setup.md

# Docker
> "@devops create Docker configuration for production"
# Output: Dockerfile, docker-compose.yml, .dockerignore

# Environment Setup
> "@devops create environment configuration for dev, staging, prod"
# Output: .env.example, environment docs

# Test Pipeline
> "@tester verify CI pipeline runs correctly"

# Commit
> "@git-manager commit devops configuration"
```

---

## Workflow 10: Documentation

**When**: New features, releases, onboarding

**Chain**:
```
@docs-manager → @code-reviewer → @git-manager
```

**Steps**:

```bash
# Update README
> "@docs-manager update README with [feature] documentation"

# API Documentation
> "@docs-manager generate API docs for [endpoints]"
# Output: docs/api/[endpoint].md

# Changelog
> "@docs-manager update changelog for version [X.Y.Z]"

# Full Docs Update
> "@docs-manager sync all documentation with current code"

# Review
> "@code-reviewer review documentation changes"

# Commit
> "@git-manager commit documentation updates"
```

---

## Workflow 11: Pre-Release Review

**When**: Before merging or releasing

**Chain**:
```
@tester → @security-auditor → @code-reviewer → @senior-developer (fixes) → @git-manager
```

**Steps**:

```bash
# Step 1: Run all checks
> "@tester run typecheck, lint, and tests. Report results."
# Output: docs/test-reports/2025-01-11-pre-merge.md

# Step 2: Security check
> "@security-auditor quick security check on changed files"

# Step 3: Code review
> "@code-reviewer review all changes. Test report: docs/test-reports/..."
# Output: docs/code-reviews/2025-01-11-[feature].md

# Step 4: Fix issues (if any)
> "@senior-developer fix issues from docs/code-reviews/..."

# Step 5: Create PR
> "@git-manager create PR with references to review and test reports"
```

---

## Workflow 12: Research & Learning

**When**: Evaluating technologies, learning best practices

**Steps**:

```bash
# Compare technologies
> "@researcher compare [A] vs [B] vs [C] for [use case]"

# Best practices
> "@researcher what are the best practices for [topic] in 2025?"

# Evaluate library
> "@researcher evaluate [library] for [purpose]. Check maintenance, security, compatibility."

# Deep dive
> "@researcher create comprehensive guide on [topic] for our team"
# Output: docs/research/2025-01-11-[topic].md
```

---

## Workflow 13: Codebase Exploration

**When**: New to project, finding code, understanding patterns

**Steps**:

```bash
# Project overview
> "@scout give me an overview of this project structure"

# Find specific code
> "@scout find all files related to [feature]"
> "@scout where is the [component/function/class]?"

# Understand patterns
> "@scout how is [feature] implemented? Show the flow."

# Find dependencies
> "@scout what files import [module]?"
> "@scout what does [file] depend on?"

# Find issues
> "@scout find all TODO and FIXME comments"
> "@scout find potential code smells in [directory]"
```

---

## Workflow Cheat Sheet

| Scenario | Workflow |
|----------|----------|
| New Feature (Full) | `@brainstormer → @architect → @planner → @senior-developer → @tester → @code-reviewer → @docs-manager → @git-manager` |
| New Feature (Quick) | `@planner → @senior-developer → @tester → @git-manager` |
| Existing Project Feature | `@scout → @researcher → @brainstormer → @planner → @senior-developer → @tester → @code-reviewer → @git-manager` |
| Bug Fix | `@debugger → @senior-developer → @tester → @git-manager` |
| Refactor | `@scout → @tester → @planner → @senior-developer → @tester → @git-manager` |
| UI Component | `@researcher → @ui-ux-designer → @senior-developer → @tester → @git-manager` |
| Database Change | `@brainstormer → @database-admin → @senior-developer → @tester → @git-manager` |
| Security Fix | `@security-auditor → @senior-developer → @tester → @security-auditor → @git-manager` |
| Pre-Release | `@tester → @security-auditor → @code-reviewer → @docs-manager → @git-manager` |
| DevOps Setup | `@devops → @docs-manager → @git-manager` |

---

## Real-World Examples

### Authentication Feature

```bash
> "@brainstormer JWT vs sessions vs OAuth for our mobile + web app"
> "@architect design auth system from docs/decisions/2025-01-11-auth-decision.md"
> "@planner create plan from docs/architecture/2025-01-11-auth-architecture.md"
> "@database-admin design user and session tables"
> "@senior-developer implement Phase 1 from docs/plans/2025-01-11-auth-plan.md"
> "@tester write auth tests covering login, logout, refresh, edge cases"
> "@security-auditor audit auth implementation"
> "@code-reviewer review auth feature"
> "@docs-manager add auth documentation to README"
> "@git-manager create PR for authentication"
```

### Performance Bug

```bash
> "@debugger the /api/orders endpoint takes 5+ seconds"
> "@database-admin analyze the slow query and suggest indexes"
> "@senior-developer implement the optimization"
> "@tester add performance test for orders endpoint"
> "@git-manager commit with 'perf(orders): add index, fix N+1 query'"
```

### New UI Component

```bash
> "@researcher find modal dialog patterns and a11y guidelines"
> "@ui-ux-designer design accessible modal with keyboard navigation"
> "@senior-developer implement modal from design spec"
> "@tester test modal across breakpoints and screen readers"
> "@git-manager commit the modal component"
```

---

*Workflow patterns for 16-agent system. Last updated: 2026-01-12*
