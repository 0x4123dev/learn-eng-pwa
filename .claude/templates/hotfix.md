# Template: Hotfix (Emergency Production Fix)

> Use this template for urgent production issues requiring immediate fixes

---

## When to Use

- Production is down or severely impacted
- Security vulnerability discovered in production
- Critical data corruption or loss risk
- Revenue-impacting bugs in production

**Key Principle**: Speed matters, but don't skip safety checks.

---

## Quick Start (Copy-Paste)

```bash
# Step 1: Create hotfix branch from production
> "@git-manager create branch hotfix/[ISSUE-ID]-[brief-description] from main"

# Step 2: Investigate quickly
> "@debugger emergency: investigate [ISSUE] in production. Focus on root cause."
# Output: docs/debug-reports/YYYY-MM-DD-hotfix-[issue].md

# Step 3: Implement minimal fix
> "@senior-developer hotfix: implement minimal fix from docs/debug-reports/...
   Rules:
   - Minimal changes only
   - No refactoring
   - No unrelated changes"

# Step 4: Test the fix
> "@tester run regression tests for affected area. Verify fix works."

# Step 5: Security check (if auth/data related)
> "@security-auditor quick security check on hotfix changes"

# Step 6: Fast code review
> "@code-reviewer emergency review of hotfix. Focus on:
   - Does it fix the issue?
   - Does it introduce new risks?
   - Is it minimal?"

# Step 7: Merge and deploy
> "@git-manager merge hotfix to main with message 'hotfix: [description]'"
```

---

## Severity Levels

| Level | Impact | Response Time | Example |
|-------|--------|---------------|---------|
| **P0 - Critical** | Production down, all users affected | Immediate | Complete outage, data loss |
| **P1 - High** | Major feature broken, many users affected | Within 1 hour | Payment processing failed |
| **P2 - Medium** | Feature degraded, some users affected | Within 4 hours | Slow responses, partial failures |
| **P3 - Low** | Minor issue, workaround exists | Within 24 hours | UI glitch, non-critical error |

---

## Detailed Workflow

### Phase 1: Assess & Branch (5 min)

**Goal**: Understand severity and create isolated fix branch

```bash
# Assess the situation
> "@scout check production logs for [ISSUE]"
> "@debugger quick assessment: what's the blast radius of [ISSUE]?"

# Create hotfix branch
> "@git-manager create branch hotfix/ISSUE-123-fix-description from main"
```

**Decision Point**: Is this truly a hotfix or can it wait?

| If... | Then... |
|-------|---------|
| Production down | Continue with hotfix |
| Security vulnerability | Continue with hotfix |
| Revenue impacted | Continue with hotfix |
| User experience degraded but functional | Consider normal bug fix workflow |
| Cosmetic issue | Normal bug fix workflow |

---

### Phase 2: Investigate Root Cause (10-30 min)

**Goal**: Find root cause quickly

```bash
> "@debugger emergency investigation:
   Issue: [DESCRIPTION]
   Symptoms: [WHAT'S HAPPENING]
   When started: [TIME]

   Focus on:
   1. What changed recently?
   2. What's in the logs?
   3. What's the minimal fix?"
# Output: docs/debug-reports/YYYY-MM-DD-hotfix-[issue].md
```

**Key Questions**:
- What was the last deployment?
- Did any config change?
- Is there a simple revert option?

---

### Phase 3: Implement Minimal Fix (15-60 min)

**Goal**: Fix the issue with minimum changes

```bash
> "@senior-developer hotfix implementation:
   Root cause: docs/debug-reports/YYYY-MM-DD-hotfix-[issue].md

   RULES:
   - Fix ONLY the issue
   - NO refactoring
   - NO code cleanup
   - NO 'while we're here' changes
   - Minimal lines changed"
```

**Minimal Fix Options** (in order of preference):

1. **Config change** - Fastest, lowest risk
2. **Feature flag** - Disable broken feature
3. **Revert** - Undo recent change
4. **Targeted fix** - Surgical code change
5. **Workaround** - Temporary band-aid (document for follow-up)

---

### Phase 4: Test (15-30 min)

**Goal**: Verify fix works without breaking other things

```bash
# Run affected tests
> "@tester run tests for affected modules: [modules]"

# Verify the fix
> "@tester verify fix:
   Before: [Expected broken behavior]
   After: [Expected fixed behavior]"

# Run full regression (if time permits)
> "@tester run full test suite"
```

**Minimum Testing Checklist**:
- [ ] Fix resolves the reported issue
- [ ] Affected module tests pass
- [ ] No new errors in test output
- [ ] Manual verification of fix (if possible)

---

### Phase 5: Security Review (If Applicable)

**When Required**:
- Auth/session changes
- Data handling changes
- API changes
- Any change touching security-related code

```bash
> "@security-auditor quick review of hotfix:
   Changes: [list files]
   Focus: Does this introduce new vulnerabilities?"
```

---

### Phase 6: Fast Code Review (10-15 min)

**Goal**: Second pair of eyes, focus on risk

```bash
> "@code-reviewer emergency review:
   Type: Hotfix
   Priority: [P0/P1/P2]

   Focus questions:
   1. Does it fix the issue?
   2. Is it minimal?
   3. Does it introduce new risks?
   4. Is there a simpler approach?"
# Output: docs/code-reviews/YYYY-MM-DD-hotfix-[issue].md
```

**Approval Criteria**:
- [ ] Fix addresses root cause
- [ ] Changes are minimal
- [ ] No new security risks
- [ ] Tests pass

---

### Phase 7: Merge & Deploy

**Goal**: Get fix to production safely

```bash
# Final checks
> "@tester verify all checks pass"

# Merge to main
> "@git-manager merge hotfix branch to main with message:
   'hotfix([scope]): [description]

    Issue: #[ISSUE-ID]
    Root cause: [brief]
    Fix: [brief]'"

# Tag if needed
> "@git-manager create tag v[X.Y.Z]-hotfix"
```

**Deployment Checklist**:
- [ ] All tests pass
- [ ] Code review approved
- [ ] Merge completed
- [ ] Deployment triggered
- [ ] Production verified working
- [ ] Monitoring confirms fix

---

### Phase 8: Post-Hotfix (Next Day)

**Goal**: Prevent recurrence, clean up

```bash
# Document the incident
> "@docs-manager create incident report for [ISSUE]"

# Create follow-up tasks
> "Create tickets for:
   - [ ] Add tests for this case
   - [ ] Improve monitoring
   - [ ] Address tech debt if any
   - [ ] Update runbook"

# Merge hotfix to develop (if using gitflow)
> "@git-manager merge main to develop"
```

---

## Hotfix Checklist

### Before Starting
- [ ] Confirmed this is production-critical
- [ ] Notified relevant stakeholders
- [ ] Created hotfix branch from main

### During Fix
- [ ] Root cause identified
- [ ] Fix is minimal (no extra changes)
- [ ] Tests verify the fix
- [ ] No new security risks

### Before Merge
- [ ] Code review approved
- [ ] All tests pass
- [ ] Deployment plan ready
- [ ] Rollback plan ready

### After Deploy
- [ ] Production verified working
- [ ] Monitoring confirmed
- [ ] Stakeholders notified
- [ ] Incident documented
- [ ] Follow-up tasks created

---

## Common Hotfix Patterns

### Pattern 1: Feature Flag Disable

```bash
> "@senior-developer disable broken feature via config:
   - Set FEATURE_X_ENABLED=false
   - Add fallback behavior"
```

### Pattern 2: Quick Revert

```bash
> "@git-manager revert commit [SHA] with message 'revert: undo [feature] due to [issue]'"
```

### Pattern 3: Rate Limit / Circuit Breaker

```bash
> "@senior-developer add circuit breaker:
   - Fail fast after N errors
   - Return cached/default response
   - Log for investigation"
```

### Pattern 4: Data Fix

```bash
> "@database-admin emergency data fix:
   - Fix corrupted data
   - Include rollback script
   - Log all changes"
```

---

## Anti-Patterns (Avoid)

| Don't | Instead |
|-------|---------|
| Skip tests | At minimum test the fix |
| Refactor while fixing | Only fix the issue |
| Push directly to main | Use hotfix branch, get review |
| Deploy without verification | Always verify in production |
| Skip documentation | Document for future reference |

---

## Rollback Plan

Always have a rollback ready:

```bash
# Option 1: Revert commit
> "@git-manager revert [hotfix-commit-sha]"

# Option 2: Deploy previous version
# Use your deployment tool to rollback

# Option 3: Feature flag
# Disable the fixed feature temporarily
```

---

## Communication Template

```
🔴 HOTFIX IN PROGRESS

Issue: [Brief description]
Severity: P[0/1/2]
Status: [Investigating/Fixing/Testing/Deploying/Resolved]
ETA: [Time estimate]

Impact: [Who/what is affected]
Workaround: [If any]

Updates: [Channel/thread]
```

---

*Template for emergency production hotfixes. Last updated: 2025-01-11*
