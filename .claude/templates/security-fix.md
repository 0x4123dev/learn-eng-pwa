# Template: Security Fix

> Use this template when addressing security vulnerabilities

---

## Quick Start

Copy and paste this workflow:

```bash
# Step 1: Audit and identify vulnerabilities
"@security-auditor audit [MODULE/AREA] for security issues"

# Step 2: Fix critical issues first
"@senior-developer fix critical security issues from docs/security/[DATE]-audit.md"

# Step 3: Verify fixes
"@security-auditor verify fixes from previous audit"

# Step 4: Add security tests
"@tester add security tests for [vulnerability type]"

# Step 5: Review
"@code-reviewer review security fixes with focus on:
- Complete remediation
- No regressions
- Defense in depth"

# Step 6: Commit (no details in public message)
"@git-manager commit 'fix(security): address vulnerabilities'"
```

---

## Security Severity Levels

### 🔴 Critical (Immediate Action)
- Remote code execution
- SQL injection
- Authentication bypass
- Data breach possible

**Response**: Fix immediately, deploy ASAP

### 🟠 High (Fix Within 24 Hours)
- Privilege escalation
- Sensitive data exposure
- XSS (stored)
- CSRF on critical actions

**Response**: Prioritize over all features

### 🟡 Medium (Fix This Week)
- Information disclosure
- XSS (reflected)
- Missing security headers
- Weak cryptography

**Response**: Schedule in current sprint

### 🟢 Low (Backlog)
- Best practice violations
- Minor information leaks
- Defense in depth gaps

**Response**: Address when convenient

---

## Detailed Workflow

### Phase 1: Security Audit

**Goal**: Identify all vulnerabilities

```bash
"@security-auditor full audit:
- OWASP Top 10 check
- Dependency vulnerabilities (npm audit)
- Code patterns review
- Configuration review"
```

**Output**: `docs/security/YYYY-MM-DD-security-audit.md`

---

### Phase 2: Prioritize

**Goal**: Address critical first

Order of remediation:
1. 🔴 Critical (immediate)
2. 🟠 High (same day)
3. 🟡 Medium (this sprint)
4. 🟢 Low (backlog)

---

### Phase 3: Fix Vulnerabilities

**Goal**: Implement secure code

```bash
# Fix each issue
"@senior-developer fix [VULNERABILITY_TYPE] in [FILE]"

# Reference the security best practice
# See: OWASP guidelines for specific vulnerability
```

### Common Fixes

#### SQL Injection
```typescript
// ❌ Vulnerable
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Fixed - Parameterized query
const query = 'SELECT * FROM users WHERE id = $1';
const result = await db.query(query, [userId]);
```

#### XSS
```typescript
// ❌ Vulnerable
element.innerHTML = userInput;

// ✅ Fixed - Escape or use textContent
element.textContent = userInput;
// Or use DOMPurify for HTML
element.innerHTML = DOMPurify.sanitize(userInput);
```

#### Hardcoded Secrets
```typescript
// ❌ Vulnerable
const API_KEY = 'sk-1234567890';

// ✅ Fixed - Use environment variables
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('API_KEY required');
```

#### Missing Auth Check
```typescript
// ❌ Vulnerable
app.get('/admin', adminController);

// ✅ Fixed - Add authentication
app.get('/admin', authMiddleware, adminController);
```

---

### Phase 4: Verify Fixes

**Goal**: Confirm vulnerabilities are resolved

```bash
"@security-auditor verify:
- All critical/high issues fixed
- No new vulnerabilities introduced
- Security headers present
- Dependencies updated"
```

---

### Phase 5: Add Security Tests

**Goal**: Prevent regression

```bash
"@tester add security tests:
- SQL injection attempts blocked
- XSS payloads escaped
- Auth required on protected routes
- Rate limiting works"
```

---

### Phase 6: Review

**Goal**: Expert review of fixes

```bash
"@code-reviewer security-focused review:
- Fixes are complete (not partial)
- Defense in depth
- No bypasses possible"
```

---

### Phase 7: Commit Carefully

**Goal**: Secure commit without leaking details

```bash
# ⚠️ Don't include vulnerability details in commit message
# ❌ Bad: "fix: SQL injection in user search"
# ✅ Good: "fix(security): address input validation issues"

"@git-manager commit 'fix(security): address security vulnerabilities'
- Don't reference CVEs in public repos
- Don't describe the vulnerability"
```

---

## Security Checklist by Category

### Authentication
- [ ] Strong password requirements
- [ ] Brute force protection (rate limiting)
- [ ] Secure password storage (bcrypt/argon2)
- [ ] Session management secure
- [ ] Logout invalidates session
- [ ] Remember me is optional

### Authorization
- [ ] Every endpoint checks permissions
- [ ] No direct object references without auth
- [ ] Privilege escalation prevented
- [ ] Admin functions protected

### Input Validation
- [ ] All input validated
- [ ] SQL queries parameterized
- [ ] HTML output escaped
- [ ] File uploads validated
- [ ] URL parameters sanitized

### Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] TLS for data in transit
- [ ] No secrets in code
- [ ] No secrets in logs
- [ ] PII handled properly

### Headers & Configuration
- [ ] Security headers set (helmet)
- [ ] CORS configured properly
- [ ] Cookie flags (HttpOnly, Secure)
- [ ] Error messages don't leak info

---

## Dependency Vulnerabilities

```bash
# Check for vulnerabilities
npm audit

# Auto-fix what's possible
npm audit fix

# For breaking changes
npm audit fix --force  # ⚠️ Test thoroughly after

# For manual fixes, update specific package
npm update [package]
```

---

## Example: Fixing Auth Vulnerabilities

```bash
# 1. Audit
"@security-auditor audit authentication system"

# Result:
# 🔴 Critical: No rate limiting on login
# 🟠 High: JWT secret is weak
# 🟡 Medium: Missing CSRF protection

# 2. Fix critical first
"@senior-developer add rate limiting to /auth/login:
- 5 attempts per 15 minutes
- Lockout after exceeded"

# 3. Fix high
"@senior-developer:
- Generate strong JWT secret (256-bit)
- Move to environment variable
- Add secret rotation plan"

# 4. Fix medium
"@senior-developer add CSRF protection:
- Install csurf
- Apply to state-changing routes
- Update frontend to send token"

# 5. Verify
"@security-auditor verify all auth fixes"

# 6. Test
"@tester add security tests:
- Rate limiting blocks after 5 attempts
- Weak tokens rejected
- CSRF tokens required"

# 7. Review
"@code-reviewer security review auth fixes"

# 8. Commit
"@git-manager commit 'fix(security): strengthen authentication'"
```

---

## Post-Fix Actions

1. **Document**: Record what was fixed (internal doc)
2. **Monitor**: Watch for exploitation attempts
3. **Rotate**: Change any potentially compromised secrets
4. **Notify**: Inform relevant stakeholders
5. **Update**: Add to security training

---

*Template for security vulnerability remediation*
