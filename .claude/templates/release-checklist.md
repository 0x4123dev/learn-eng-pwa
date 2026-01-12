# Template: Release Checklist

> Use this template before deploying to production

---

## Quick Reference

```bash
# Pre-release validation
"@tester run full test suite with coverage report"
"@security-auditor quick security check before release"
"@code-reviewer final review of release branch"
"@docs-manager update changelog for version [X.Y.Z]"
"@git-manager tag and create release"
```

---

## Release Types

### Major Release (X.0.0)
- Breaking changes
- Major new features
- Full validation required

### Minor Release (0.X.0)
- New features (backwards compatible)
- Deprecations
- Standard validation

### Patch Release (0.0.X)
- Bug fixes only
- No new features
- Quick validation

---

## Pre-Release Checklist

### 1. Code Quality ✅

```bash
# All checks must pass
npm run typecheck    # ✅ No type errors
npm run lint         # ✅ No lint errors
npm run build        # ✅ Build succeeds
```

- [ ] TypeScript strict mode passes
- [ ] No ESLint errors
- [ ] No console.log in production code
- [ ] Build completes successfully

---

### 2. Testing ✅

```bash
# Run full test suite
npm test -- --coverage
```

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Coverage ≥ 80%
- [ ] No skipped tests (unless documented)
- [ ] E2E tests pass (if applicable)

**Test Report Location**: `docs/test-reports/YYYY-MM-DD-release.md`

---

### 3. Security ✅

```bash
# Dependency audit
npm audit

# Code security check
"@security-auditor pre-release security check"
```

- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities
- [ ] Secrets not in codebase
- [ ] Auth/permissions tested
- [ ] Security headers configured

**Security Report**: `docs/security/YYYY-MM-DD-release-audit.md`

---

### 4. Documentation ✅

```bash
"@docs-manager verify documentation is current"
```

- [ ] README updated
- [ ] API documentation current
- [ ] CHANGELOG updated
- [ ] Breaking changes documented
- [ ] Migration guide (if breaking)
- [ ] Environment variables documented

---

### 5. Database ✅

- [ ] Migrations tested (up and down)
- [ ] Data migrations safe
- [ ] Backups verified
- [ ] Rollback tested

```bash
# Test migrations
npm run db:migrate    # Apply
npm run db:rollback   # Rollback
npm run db:migrate    # Re-apply
```

---

### 6. Performance ✅

- [ ] No performance regressions
- [ ] Load tested (for major releases)
- [ ] Database queries optimized
- [ ] Bundle size acceptable

```bash
# Check bundle size
npm run build
du -sh dist/
```

---

### 7. Configuration ✅

- [ ] Environment variables set in production
- [ ] Secrets rotated if needed
- [ ] Feature flags configured
- [ ] Monitoring configured

---

### 8. Rollback Plan ✅

- [ ] Previous version tagged
- [ ] Rollback procedure documented
- [ ] Database rollback ready
- [ ] Team knows rollback steps

**Rollback Command**:
```bash
# If deployment fails
git checkout v[PREVIOUS_VERSION]
npm run db:rollback  # If migration needed
npm run build
npm start
```

---

## Release Process

### Step 1: Final Validation

```bash
# Run all checks
npm run typecheck && npm run lint && npm test && npm run build
```

### Step 2: Update Version

```bash
# Update package.json version
npm version [major|minor|patch]
```

### Step 3: Update Changelog

```bash
"@docs-manager update CHANGELOG.md for version [X.Y.Z]:
- Group by Added, Changed, Fixed, Security
- Include PR/issue references"
```

### Step 4: Create Release

```bash
"@git-manager create release:
- Tag version
- Create GitHub release
- Include changelog notes"
```

### Step 5: Deploy to Staging

```bash
# Deploy to staging first
# Run smoke tests
# Monitor for issues
```

### Step 6: Production Deployment

```bash
# Deploy to production
# Monitor closely for 30 minutes
# Watch error rates and metrics
```

### Step 7: Post-Deployment Verification

- [ ] Application starts correctly
- [ ] Health checks pass
- [ ] Critical flows work
- [ ] No error spikes
- [ ] Performance normal

---

## Release Notes Template

```markdown
# Release v[X.Y.Z]

**Release Date**: YYYY-MM-DD

## Highlights

[1-2 sentence summary of the release]

## Added
- Feature 1 (#PR)
- Feature 2 (#PR)

## Changed
- Change 1 (#PR)
- Change 2 (#PR)

## Fixed
- Bug fix 1 (#Issue)
- Bug fix 2 (#Issue)

## Security
- Security fix 1 (if applicable)

## Breaking Changes
- Description of breaking change
- Migration steps

## Upgrade Guide

[Steps to upgrade from previous version]

## Contributors

@username1, @username2
```

---

## Emergency Release (Hotfix)

For critical production issues:

```bash
# 1. Create hotfix branch from production
git checkout main
git checkout -b hotfix/[issue]

# 2. Fix the issue
"@debugger investigate [ISSUE]"
"@senior-developer fix [ISSUE]"

# 3. Quick test
npm test

# 4. Security check (quick)
"@security-auditor quick check of hotfix"

# 5. Deploy directly to production
# (Skip staging if truly critical)

# 6. Merge back to develop
git checkout develop
git merge hotfix/[issue]
```

---

## Post-Release

### Immediate (< 1 hour)
- [ ] Verify deployment successful
- [ ] Check error monitoring
- [ ] Test critical paths manually
- [ ] Announce release to team

### Short-term (< 1 day)
- [ ] Monitor user feedback
- [ ] Check performance metrics
- [ ] Document any issues found
- [ ] Plan for quick patches if needed

### Follow-up (< 1 week)
- [ ] Retrospective on release process
- [ ] Document lessons learned
- [ ] Update automation if issues found

---

## Quick Commands Summary

```bash
# Full pre-release check
npm run typecheck && npm run lint && npm test && npm run build && npm audit

# Version bump
npm version [major|minor|patch]

# Create release
"@git-manager tag v[X.Y.Z] and create GitHub release"

# Emergency rollback
git checkout v[PREVIOUS] && npm run build && npm start
```

---

*Template for release validation and deployment*
