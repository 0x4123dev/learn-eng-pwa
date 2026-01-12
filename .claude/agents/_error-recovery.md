# Agent Error Recovery Patterns

> Standard error handling and recovery procedures for all agents

---

## Quick Reference

| Error Type | Recovery Action |
|------------|-----------------|
| File not found | List available files, ask user |
| Tests failing | Save partial report, handoff to @debugger |
| Build failing | Check error logs, fix or escalate |
| Dependency missing | Suggest installation command |
| Permission denied | Warn user, suggest fix |
| Context lost | Request file references from user |
| Blocked by another task | Wait or work on different item |

---

## Common Error Patterns

### 1. File Not Found

**When**: Required input file doesn't exist

**Detection**:
```bash
# Check if file exists
ls docs/decisions/[expected-file].md 2>/dev/null || echo "NOT FOUND"
```

**Recovery Steps**:
1. List available files in the expected directory
2. Suggest similar files that might be correct
3. Ask user to provide the correct path

**Response Template**:
```markdown
⚠️ **File Not Found**

Expected: `docs/decisions/2025-01-11-auth-decision.md`

**Available files in docs/decisions/**:
- 2025-01-10-caching-decision.md
- 2025-01-09-database-decision.md

**Options**:
1. Did you mean one of these files?
2. Should I ask @brainstormer to create a decision first?
3. Provide the correct file path.
```

---

### 2. Tests Failing

**When**: Test suite reports failures

**Detection**:
```bash
npm test 2>&1 | grep -E "(FAIL|Error|failed)"
```

**Recovery Steps**:
1. Capture and analyze error output
2. Identify which tests failed and why
3. Determine if it's a code issue or test issue
4. Either fix or escalate to appropriate agent

**Response Template**:
```markdown
❌ **Tests Failing**

**Failed Tests**: 3 of 45
**Passing**: 42

**Failures**:
1. `auth.test.ts` - login() - Expected 200, got 401
2. `auth.test.ts` - refresh() - Timeout after 5000ms
3. `user.test.ts` - getProfile() - User not found

**Analysis**:
- Failures appear related to authentication setup
- Likely cause: Test database not seeded

**Options**:
1. "@debugger investigate test failures"
2. "@senior-developer fix auth setup in tests"
3. Check if database migrations ran: `npm run db:migrate`
```

---

### 3. Build Failing

**When**: TypeScript compilation or build process fails

**Detection**:
```bash
npm run build 2>&1 | grep -E "(error TS|Error:|Cannot find)"
```

**Recovery Steps**:
1. Parse error messages to identify issues
2. Categorize errors (type errors, import errors, syntax)
3. Fix if straightforward, escalate if complex

**Response Template**:
```markdown
❌ **Build Failed**

**Errors**: 5 TypeScript errors

**Error Summary**:
| File | Line | Error |
|------|------|-------|
| src/auth.ts | 45 | Property 'token' does not exist |
| src/user.ts | 23 | Cannot find module './utils' |
| src/api.ts | 12 | Type 'string' not assignable to 'number' |

**Quick Fixes Available**: 3 of 5

**Options**:
1. I can fix the 3 straightforward type errors
2. "@senior-developer fix all build errors"
3. Run `npm run typecheck` for detailed output
```

---

### 4. Dependency Missing

**When**: Required package not installed

**Detection**:
```bash
npm ls [package] 2>&1 | grep -E "(missing|not found|UNMET)"
```

**Recovery Steps**:
1. Identify the missing dependency
2. Check if it should be in package.json
3. Suggest installation command

**Response Template**:
```markdown
⚠️ **Missing Dependency**

**Package**: `@prisma/client`
**Required by**: `src/infrastructure/database.ts`

**Status**: Not in node_modules

**Solution**:
```bash
npm install @prisma/client
```

Or if it should already be installed:
```bash
npm install  # Reinstall all dependencies
```

Should I run the installation command?
```

---

### 5. Permission Denied

**When**: Cannot read/write to file or directory

**Recovery Steps**:
1. Identify the permission issue
2. Suggest appropriate fix
3. Do NOT attempt to fix permissions automatically

**Response Template**:
```markdown
⚠️ **Permission Denied**

**File**: `/etc/hosts` (or protected file)
**Operation**: Write

I cannot modify this file due to system permissions.

**User Action Required**:
```bash
# If you need to modify this file:
sudo chmod 644 /path/to/file
# Or run with elevated permissions
```

Would you like me to suggest an alternative approach?
```

---

### 6. Context Lost Between Sessions

**When**: Previous conversation context not available

**Detection**: Agent asked to continue work without file references

**Recovery Steps**:
1. Ask user for relevant file references
2. List recent files in expected directories
3. Reconstruct context from files

**Response Template**:
```markdown
⚠️ **Context Needed**

I don't have context from the previous session.

**To continue, please provide**:
- Decision document: `docs/decisions/[file].md`
- Plan document: `docs/plans/[file].md`
- Current progress: Which phase/step?

**Recent files I found**:
```
docs/decisions/
  - 2025-01-11-auth-decision.md (2 hours ago)

docs/plans/
  - 2025-01-11-auth-plan.md (1 hour ago)
```

Which files should I reference?
```

---

### 7. Blocked by External Dependency

**When**: Cannot proceed due to missing external input

**Recovery Steps**:
1. Document what is blocking
2. Suggest workarounds if possible
3. Create placeholder and continue with other work

**Response Template**:
```markdown
⏸️ **Blocked**

**Waiting for**: API specification from backend team
**Blocking**: Payment integration implementation

**Options**:
1. Create mock API based on expected interface
2. Work on other parts that don't need the API
3. Wait for specification

**I can continue with**:
- [ ] UI components (no API dependency)
- [ ] Database models
- [ ] Unit tests for business logic

Which should I work on while waiting?
```

---

### 8. Merge Conflict

**When**: Git reports conflicts during merge/rebase

**Detection**:
```bash
git status | grep -E "(both modified|Unmerged)"
```

**Recovery Steps**:
1. Identify conflicting files
2. Show conflict sections
3. Ask user for resolution preference

**Response Template**:
```markdown
⚠️ **Merge Conflict**

**Conflicting Files**:
1. `src/auth/login.ts` - Both modified
2. `src/config.ts` - Both modified

**Conflict in src/auth/login.ts**:
```
<<<<<<< HEAD
const timeout = 5000;
=======
const timeout = 10000;
>>>>>>> feature/auth-update
```

**Options**:
1. Keep current (HEAD): 5000
2. Accept incoming: 10000
3. Manual resolution needed
4. "@senior-developer resolve conflicts"

Which resolution for each conflict?
```

---

### 9. Rate Limit or API Error

**When**: External API calls fail

**Recovery Steps**:
1. Identify the failing API
2. Check for rate limits
3. Implement retry with backoff or suggest waiting

**Response Template**:
```markdown
⚠️ **API Error**

**Service**: GitHub API
**Error**: 403 Rate Limit Exceeded
**Reset**: In 45 minutes

**Options**:
1. Wait 45 minutes and retry
2. Use cached data if available
3. Continue with other tasks

Should I proceed with tasks that don't require this API?
```

---

### 10. Circular Dependency Detected

**When**: Agent workflow creates a loop

**Detection**: Same agent called multiple times for same task

**Recovery Steps**:
1. Identify the cycle
2. Break the cycle with user decision
3. Document to prevent recurrence

**Response Template**:
```markdown
⚠️ **Workflow Cycle Detected**

**Cycle**:
@code-reviewer → @senior-developer → @tester → @code-reviewer (repeat)

**Cause**: Code review keeps finding new issues after fixes

**Breaking the cycle**:
1. Accept current state with known issues documented
2. Escalate to user for decision
3. Time-box: One more iteration then proceed

How should we proceed?
```

---

## Agent-Specific Recovery

### @brainstormer
| Error | Recovery |
|-------|----------|
| No clear winner between options | Present trade-offs, ask user to decide |
| Insufficient information | Ask clarifying questions |
| Conflicting requirements | Document conflicts, escalate to user |

### @planner
| Error | Recovery |
|-------|----------|
| No decision document | Ask for @brainstormer first |
| Scope too large | Break into multiple plans |
| Missing dependencies | List what's needed first |

### @senior-developer
| Error | Recovery |
|-------|----------|
| No plan exists | Ask for @planner first |
| Unclear requirements | Check plan, ask for clarification |
| Breaking existing tests | Pause, analyze, fix or @debugger |

### @tester
| Error | Recovery |
|-------|----------|
| No code to test | Ask for @senior-developer first |
| Flaky tests | Mark as flaky, investigate root cause |
| Environment issues | Document setup requirements |

### @code-reviewer
| Error | Recovery |
|-------|----------|
| No test report | Ask for @tester first |
| Too many issues | Prioritize, fix critical first |
| Unclear code purpose | Check plan document |

### @git-manager
| Error | Recovery |
|-------|----------|
| No approval | Ask for @code-reviewer first |
| Secrets detected | Block commit, list findings |
| Conflict with remote | Pull, resolve, retry |

---

## Recovery Escalation Path

```
1. Agent Self-Recovery
   ↓ (if fails)
2. Handoff to Specialized Agent
   ↓ (if fails)
3. Ask User for Decision
   ↓ (if blocked)
4. Document and Pause

Example:
@senior-developer encounters test failure
  → Attempts quick fix
  → Fails → Handoff to @debugger
  → @debugger investigates
  → Cannot determine cause → Ask user
```

---

## Logging Errors

When encountering errors, always log:

```markdown
## Error Log Entry

**Timestamp**: YYYY-MM-DD HH:MM
**Agent**: @[agent-name]
**Task**: [what was being attempted]
**Error**: [error message/type]
**Context**: [relevant details]
**Recovery Attempted**: [what was tried]
**Resolution**: [how it was resolved or escalated]
```

---

## Best Practices

1. **Fail Fast**: Detect errors early, don't proceed with broken state
2. **Be Specific**: Provide exact error messages and locations
3. **Offer Options**: Give user choices for recovery
4. **Document**: Log errors for pattern detection
5. **Don't Assume**: When unsure, ask rather than guess
6. **Preserve Work**: Save partial progress before failing
7. **Clean Up**: If rolling back, ensure clean state

---

*Error recovery patterns for 16-agent system. Last updated: 2025-01-11*
