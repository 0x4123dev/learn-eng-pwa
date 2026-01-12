# Template: Code Refactoring

> Use this template when restructuring code without changing behavior

---

## Quick Start

Copy and paste this workflow:

```bash
# Step 1: Understand current code
"@scout analyze [MODULE/FILE] - show structure, patterns, and issues"

# Step 2: Ensure test coverage exists
"@tester check coverage for [MODULE]. Write tests for any uncovered code."

# Step 3: Plan the refactor
"@planner create refactoring plan for [MODULE]:
- What to change
- What to preserve
- Risks and rollback"

# Step 4: Refactor incrementally
"@senior-developer refactor step 1 from docs/plans/[DATE]-refactor-[MODULE].md"
"@tester run tests"
# Repeat for each step

# Step 5: Review
"@code-reviewer review refactoring"

# Step 6: Commit
"@git-manager commit 'refactor([scope]): [description]'"
```

---

## Golden Rules of Refactoring

```
1. TESTS FIRST  → Never refactor without tests
2. SMALL STEPS  → One change at a time
3. RUN TESTS    → After every change
4. NO FEATURES  → Only restructure, never add
5. PRESERVE API → Keep public interfaces stable
6. COMMIT OFTEN → Easy to rollback
```

---

## Detailed Workflow

### Phase 1: Understand Current State

**Goal**: Know what you're changing

```bash
"@scout analyze [MODULE]:
- Current structure
- Dependencies (incoming and outgoing)
- Problem areas
- Test coverage"
```

**Questions to answer**:
- What does this code do?
- What depends on it?
- What does it depend on?
- What tests exist?

---

### Phase 2: Ensure Test Coverage

**Goal**: Safety net before changes

```bash
# Check current coverage
"@tester report coverage for [MODULE]"

# Add tests if needed
"@tester write tests for [MODULE] to achieve ≥80% coverage"
```

**Critical**: DO NOT proceed without adequate tests!

---

### Phase 3: Plan Refactoring

**Goal**: Clear, incremental steps

```bash
"@planner create refactoring plan:
- Break into atomic steps
- Each step should pass all tests
- Include rollback strategy"
```

**Output**: `docs/plans/YYYY-MM-DD-refactor-[module]-plan.md`

---

### Phase 4: Execute Incrementally

**Goal**: Safe, reversible changes

```bash
# For each step in the plan:
"@senior-developer refactor step N from plan"

# Immediately verify
"npm test"  # MUST pass

# If tests fail → revert and reassess
"git checkout -- ."

# If tests pass → commit
"@git-manager commit 'refactor([scope]): step N - [description]'"
```

**Commit after each step**, not at the end!

---

### Phase 5: Review

**Goal**: Verify quality improvement

```bash
"@code-reviewer review refactoring:
- Is behavior preserved?
- Is code better?
- Are tests still valid?"
```

---

## Refactoring Patterns

### Extract Function
```bash
"@senior-developer extract [logic] from [function] into new function [name]"
```

### Extract Class/Module
```bash
"@senior-developer extract [responsibility] from [class] into new class [name]"
```

### Rename
```bash
"@senior-developer rename [old] to [new] across codebase"
```

### Move
```bash
"@senior-developer move [function/class] from [file] to [new-file]"
```

### Simplify
```bash
"@senior-developer simplify [function] by [removing duplication / flattening nesting / etc.]"
```

---

## Common Refactoring Scenarios

### 1. God Class/File
**Problem**: File > 300 lines, too many responsibilities
**Solution**: Extract into multiple focused classes

```bash
"@planner plan to split [large-file] into:
- [Name]Service (business logic)
- [Name]Validator (validation)
- [Name]Repository (data access)"
```

### 2. Duplicate Code
**Problem**: Same logic in multiple places
**Solution**: Extract to shared utility

```bash
"@senior-developer extract duplicate [logic] into shared/[utility].ts"
```

### 3. Deep Nesting
**Problem**: Code with 4+ levels of nesting
**Solution**: Early returns, extract functions

```bash
"@senior-developer flatten [function] using early returns and extraction"
```

### 4. Long Parameter List
**Problem**: Function with 5+ parameters
**Solution**: Introduce parameter object

```bash
"@senior-developer create [Name]Options interface for [function] parameters"
```

### 5. Primitive Obsession
**Problem**: Using primitives instead of domain objects
**Solution**: Introduce value objects

```bash
"@senior-developer replace [primitive] with [ValueObject] type"
```

---

## Checklist

Before starting:
- [ ] Tests exist for code being refactored
- [ ] Coverage is ≥80%
- [ ] Refactoring plan created
- [ ] No feature changes included

During:
- [ ] Tests pass after each step
- [ ] Commits after each step
- [ ] Only structural changes

After:
- [ ] All tests still pass
- [ ] Coverage not decreased
- [ ] Code review approved
- [ ] Performance not degraded

---

## Anti-Patterns (What NOT to Do)

| Anti-Pattern | Why It's Bad | Instead Do |
|--------------|--------------|------------|
| Big bang refactor | Can't rollback | Small steps |
| Refactor without tests | No safety net | Tests first |
| Refactor + feature | Hard to review | Separate PRs |
| Skip test runs | Bugs slip in | Test after each change |
| One big commit | Can't bisect | Commit per step |

---

## Example: Refactoring OrderService

```bash
# 1. Understand
"@scout analyze src/services/order.service.ts"
# Result: 450 lines, 3 responsibilities, 70% coverage

# 2. Add tests
"@tester increase coverage for OrderService to 90%"

# 3. Plan
"@planner create refactoring plan to split OrderService:
- OrderService: orchestration only
- OrderValidator: validation logic
- OrderCalculator: price calculations"

# 4. Execute step by step
"@senior-developer extract validation logic to OrderValidator"
"npm test" # ✅ Pass
"@git-manager commit 'refactor(orders): extract OrderValidator'"

"@senior-developer extract calculations to OrderCalculator"
"npm test" # ✅ Pass
"@git-manager commit 'refactor(orders): extract OrderCalculator'"

"@senior-developer update OrderService to use new classes"
"npm test" # ✅ Pass
"@git-manager commit 'refactor(orders): simplify OrderService'"

# 5. Review
"@code-reviewer review order service refactoring"

# 6. Final commit/PR
"@git-manager create PR for order service refactoring"
```

---

*Template for safe code refactoring*
