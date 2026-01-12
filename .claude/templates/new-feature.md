# Template: New Feature Development

> Use this template when building a new feature from scratch

---

## Quick Start

Copy and paste this workflow:

```bash
# Step 1: Explore and decide approach
"@brainstormer explore options for [FEATURE_NAME]. Consider:
- Our current tech stack (see .claude/project.config.md)
- Integration with existing code
- Trade-offs between approaches"

# Step 2: Design architecture (for complex features)
"@architect design architecture from docs/decisions/[DATE]-[FEATURE]-decision.md"

# Step 3: Create implementation plan
"@planner create plan from docs/architecture/[DATE]-[FEATURE]-architecture.md"
# Or for simpler features:
"@planner create plan from docs/decisions/[DATE]-[FEATURE]-decision.md"

# Step 4: Implement phase by phase
"@senior-developer implement Phase 1 from docs/plans/[DATE]-[FEATURE]-plan.md"

# Step 5: Test each phase
"@tester write tests for Phase 1"

# Step 6: Repeat steps 4-5 for remaining phases

# Step 7: Security check (if auth/data related)
"@security-auditor audit [FEATURE_NAME]"

# Step 8: Code review
"@code-reviewer review [FEATURE_NAME]"

# Step 9: Fix any issues
"@senior-developer fix issues from docs/code-reviews/[DATE]-[FEATURE].md"

# Step 10: Update documentation
"@docs-manager update README for [FEATURE_NAME]"

# Step 11: Commit and PR
"@git-manager commit and create PR for [FEATURE_NAME]"
```

---

## Detailed Workflow

### Phase 1: Discovery & Decision

**Goal**: Understand requirements and decide approach

```bash
# If you need research first
"@researcher find best practices for [FEATURE_TYPE] in [FRAMEWORK/LANGUAGE]"

# Make the decision
"@brainstormer [FEATURE_NAME] - evaluate options:
1. Option A: [description]
2. Option B: [description]
Consider: performance, maintainability, team familiarity"
```

**Output**: `docs/decisions/YYYY-MM-DD-[feature]-decision.md`

---

### Phase 2: Architecture (Complex Features Only)

**Goal**: Design system structure before implementation

```bash
"@architect design [FEATURE_NAME] architecture:
- Components needed
- Data flow
- API contracts
- Database changes"
```

**Output**: `docs/architecture/YYYY-MM-DD-[feature]-architecture.md`

**Skip if**: Simple CRUD, UI-only changes, bug fixes

---

### Phase 3: Planning

**Goal**: Break down into implementable tasks

```bash
"@planner create implementation plan for [FEATURE_NAME]:
- Break into phases
- Estimate complexity
- Identify dependencies
- Define acceptance criteria"
```

**Output**: `docs/plans/YYYY-MM-DD-[feature]-plan.md`

---

### Phase 4: Implementation

**Goal**: Write the code

```bash
# Implement one phase at a time
"@senior-developer implement Phase 1 from docs/plans/[DATE]-[FEATURE]-plan.md"

# After each phase, run tests
"@tester run tests"

# Continue with next phase
"@senior-developer implement Phase 2..."
```

**Output**: Source code in `src/`

---

### Phase 5: Testing

**Goal**: Ensure quality and coverage

```bash
# Write tests for new code
"@tester write tests for [FEATURE_NAME] including:
- Unit tests for services
- Integration tests for APIs
- Edge cases"

# Run full test suite
"@tester run all tests and report coverage"
```

**Output**: `docs/test-reports/YYYY-MM-DD-[feature].md`

---

### Phase 6: Review & Polish

**Goal**: Ensure code quality

```bash
# Security check (if applicable)
"@security-auditor quick audit of [FEATURE_NAME]"

# Code review
"@code-reviewer review [FEATURE_NAME]. References:
- Plan: docs/plans/[DATE]-[FEATURE]-plan.md
- Tests: docs/test-reports/[DATE]-[FEATURE].md"

# Fix issues if any
"@senior-developer fix issues from docs/code-reviews/[DATE]-[FEATURE].md"
```

**Output**: `docs/code-reviews/YYYY-MM-DD-[feature].md`

---

### Phase 7: Documentation & Merge

**Goal**: Document and merge

```bash
# Update docs
"@docs-manager update documentation for [FEATURE_NAME]:
- README if user-facing
- API docs if new endpoints
- Changelog entry"

# Create PR
"@git-manager commit and create PR for [FEATURE_NAME]"
```

---

## Checklist

Before marking complete:

- [ ] Decision documented
- [ ] Plan created and followed
- [ ] All phases implemented
- [ ] Tests written (≥80% coverage)
- [ ] Security reviewed (if applicable)
- [ ] Code review approved
- [ ] Documentation updated
- [ ] PR created

---

## Example: Authentication Feature

```bash
# 1. Decision
"@brainstormer should we use JWT or sessions for authentication?
Consider: mobile app support, scaling needs, team experience"

# 2. Architecture
"@architect design auth system from docs/decisions/2025-01-11-auth-decision.md"

# 3. Plan
"@planner create plan from docs/architecture/2025-01-11-auth-architecture.md"

# 4. Implement
"@senior-developer implement Phase 1: User model and types"
"@tester test user model"
"@senior-developer implement Phase 2: Auth service"
"@tester test auth service"
"@senior-developer implement Phase 3: API endpoints"
"@tester test API endpoints"

# 5. Security
"@security-auditor audit auth implementation"

# 6. Review
"@code-reviewer review auth feature"

# 7. Docs
"@docs-manager add auth documentation to README"

# 8. PR
"@git-manager create PR for authentication feature"
```

---

*Template for new feature development*
