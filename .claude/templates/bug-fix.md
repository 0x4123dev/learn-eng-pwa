# Template: Bug Fix

> Use this template when investigating and fixing bugs

---

## Quick Start

Copy and paste this workflow:

```bash
# Step 1: Investigate the bug
"@debugger investigate [BUG_DESCRIPTION]
Error: [error message if any]
Steps to reproduce: [steps]
Expected: [expected behavior]
Actual: [actual behavior]"

# Step 2: Fix the bug
"@senior-developer fix bug from docs/debug-reports/[DATE]-[BUG].md"

# Step 3: Add regression test
"@tester add regression test for [BUG_DESCRIPTION]"

# Step 4: Quick review
"@code-reviewer review bug fix for [BUG_DESCRIPTION]"

# Step 5: Commit
"@git-manager commit with message 'fix([scope]): [description]' refs #[ISSUE]"
```

---

## Detailed Workflow

### Phase 1: Investigation

**Goal**: Understand root cause

```bash
"@debugger investigate [BUG]:
- Reproduce the issue
- Check logs for errors
- Trace the code path
- Identify root cause"
```

**Output**: `docs/debug-reports/YYYY-MM-DD-[bug].md`

**The debug report should include**:
- Steps to reproduce
- Root cause analysis
- Affected files
- Suggested fix

---

### Phase 2: Fix Implementation

**Goal**: Implement the fix

```bash
# Read the debug report
"@senior-developer fix bug from docs/debug-reports/[DATE]-[BUG].md"
```

**Guidelines**:
- Fix only the bug, don't refactor
- Keep changes minimal
- Don't introduce new features
- Preserve existing behavior

---

### Phase 3: Regression Test

**Goal**: Prevent bug from recurring

```bash
"@tester add regression test that:
- Reproduces the original bug scenario
- Verifies the fix works
- Covers edge cases"
```

**Test naming**: `test_[bug_description]_should_[expected_behavior]`

---

### Phase 4: Review

**Goal**: Verify fix is correct and complete

```bash
"@code-reviewer review bug fix:
- Does it fix the root cause?
- Are there side effects?
- Is the regression test adequate?"
```

---

### Phase 5: Commit

**Goal**: Create proper commit

```bash
"@git-manager commit with:
- Type: fix
- Scope: [affected module]
- Message: [what was fixed]
- Reference: #[issue number]"
```

**Commit format**: `fix(auth): resolve token expiration race condition #123`

---

## Bug Severity Guide

### 🔴 Critical (Fix Immediately)
- Production is down
- Data loss occurring
- Security vulnerability
- All users affected

**Workflow**: Debug → Fix → Test → Deploy (skip review if needed)

### 🟠 High (Fix Today)
- Major feature broken
- Significant user impact
- Workaround is painful

**Workflow**: Full workflow, prioritized

### 🟡 Medium (Fix This Sprint)
- Minor feature broken
- Workaround available
- Limited user impact

**Workflow**: Full workflow

### 🟢 Low (Backlog)
- Cosmetic issues
- Edge cases
- Minor inconvenience

**Workflow**: Full workflow when capacity allows

---

## Checklist

Before marking complete:

- [ ] Root cause identified (not just symptoms)
- [ ] Fix addresses root cause
- [ ] Regression test added
- [ ] No side effects introduced
- [ ] Code review approved (if time allows)
- [ ] Commit message references issue

---

## Example: Login Timeout Bug

```bash
# 1. Investigate
"@debugger investigate login timeout error:
- Users report 'Request timeout' on login
- Error: ETIMEDOUT after 30 seconds
- Happens intermittently
- Started after deploy on 2025-01-10"

# 2. Debug report shows: Database connection pool exhausted

# 3. Fix
"@senior-developer fix database connection pool issue:
- Increase pool size
- Add connection timeout
- Add proper cleanup"

# 4. Test
"@tester add test for database connection under load"

# 5. Review
"@code-reviewer review connection pool fix"

# 6. Commit
"@git-manager commit 'fix(db): increase connection pool and add timeout' refs #456"
```

---

## Common Bug Patterns

| Symptom | Likely Cause | First Check |
|---------|--------------|-------------|
| Timeout | Connection pool, slow query | Database logs |
| 500 Error | Unhandled exception | Error logs |
| Wrong data | Cache stale, race condition | Cache invalidation |
| Auth failure | Token expired, wrong secret | Token validation |
| Memory leak | Unclosed connections | Memory profile |

---

*Template for bug fix workflow*
