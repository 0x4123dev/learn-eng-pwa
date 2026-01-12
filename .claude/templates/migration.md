# Template: Database & API Migration

> Use this template for schema changes, data migrations, and API version migrations

---

## When to Use

- Database schema changes (tables, columns, indexes)
- Data migrations (transforming existing data)
- API version upgrades or breaking changes
- Service migrations (moving data between services)
- Infrastructure migrations (database engine changes)

---

## Quick Start (Copy-Paste)

### Database Migration

```bash
# Step 1: Design the change
> "@brainstormer evaluate migration approach for [CHANGE]. Consider:
   - Data volume
   - Downtime requirements
   - Rollback strategy"
# Output: docs/decisions/YYYY-MM-DD-[change]-migration-decision.md

# Step 2: Create migration plan
> "@database-admin create migration plan from docs/decisions/...
   Include:
   - Schema changes (UP and DOWN)
   - Data transformation
   - Indexes
   - Rollback script"
# Output: docs/database/YYYY-MM-DD-[change]-migration.md

# Step 3: Implement migration
> "@senior-developer create migration files from docs/database/..."

# Step 4: Test migration
> "@tester test migration:
   - Fresh apply
   - Rollback
   - Re-apply
   - Data integrity check"

# Step 5: Review
> "@code-reviewer review migration for safety and performance"

# Step 6: Deploy
> "@git-manager commit migration"
```

### API Migration

```bash
# Step 1: Plan the migration
> "@architect design API migration strategy for [CHANGE]. Consider:
   - Backward compatibility
   - Client migration timeline
   - Version deprecation"
# Output: docs/architecture/YYYY-MM-DD-api-migration.md

# Step 2: Implement
> "@senior-developer implement API changes:
   - Add new version
   - Maintain old version
   - Add deprecation warnings"

# Step 3: Document
> "@docs-manager update API documentation for new version"

# Step 4: Test
> "@tester test both API versions"

# Step 5: Deploy and communicate
> "@git-manager commit and create PR for API migration"
```

---

## Migration Types

### Type 1: Additive (Low Risk)

Adding new tables, columns, indexes without modifying existing data.

**Examples**:
- Add new nullable column
- Create new table
- Add new index

**Workflow**:
```
@database-admin → @senior-developer → @tester → @git-manager
```

### Type 2: Transformative (Medium Risk)

Modifying existing data or schema structure.

**Examples**:
- Rename column
- Change data type
- Split/merge tables
- Data backfill

**Workflow**:
```
@brainstormer → @database-admin → @senior-developer → @tester → @code-reviewer → @git-manager
```

### Type 3: Destructive (High Risk)

Removing data or schema elements.

**Examples**:
- Drop table/column
- Delete data
- Remove constraints

**Workflow**:
```
@brainstormer → @database-admin → @security-auditor → @senior-developer → @tester → @code-reviewer → @git-manager
```

---

## Phase 1: Planning

### Decision Document

```bash
> "@brainstormer evaluate migration for [CHANGE]:

   Context:
   - Current state: [what exists now]
   - Target state: [what we want]
   - Data volume: [approximate rows/size]

   Questions:
   1. Can we do this with zero downtime?
   2. What's the rollback strategy?
   3. How long will migration take?
   4. What are the risks?"
# Output: docs/decisions/YYYY-MM-DD-[change]-migration-decision.md
```

### Key Decisions to Make

| Decision | Options |
|----------|---------|
| **Downtime** | Zero-downtime / Maintenance window / Acceptable brief outage |
| **Strategy** | Big bang / Gradual / Dual-write |
| **Rollback** | Automatic / Manual / Point-in-time recovery |
| **Timing** | Off-peak / During deployment / Scheduled maintenance |

---

## Phase 2: Migration Design

### Database Migration Plan

```bash
> "@database-admin create detailed migration plan:

   Decision: docs/decisions/YYYY-MM-DD-[change]-migration-decision.md

   Required sections:
   1. Pre-migration checks
   2. UP migration (apply changes)
   3. Data transformation (if any)
   4. DOWN migration (rollback)
   5. Post-migration verification
   6. Performance impact analysis"
# Output: docs/database/YYYY-MM-DD-[change]-migration.md
```

### Migration Document Template

```markdown
# Migration: [Name]

## Overview
- **Type**: Additive / Transformative / Destructive
- **Risk Level**: Low / Medium / High
- **Estimated Duration**: [time]
- **Downtime Required**: Yes / No

## Pre-Migration Checklist
- [ ] Backup completed
- [ ] Tested on staging
- [ ] Rollback tested
- [ ] Team notified
- [ ] Monitoring ready

## Changes

### UP Migration
```sql
-- Add your UP migration here
```

### DOWN Migration (Rollback)
```sql
-- Add your rollback here
```

### Data Migration (if needed)
```sql
-- Data transformation queries
```

## Verification Queries
```sql
-- Queries to verify migration success
```

## Rollback Plan
1. [Step 1]
2. [Step 2]
```

---

## Phase 3: Implementation

### Create Migration Files

```bash
> "@senior-developer create migration from docs/database/...:

   Requirements:
   - Use migration framework (Prisma/Knex/etc)
   - Include UP and DOWN migrations
   - Add verification queries
   - Handle errors gracefully"
```

### Migration File Structure

```typescript
// Example: Prisma migration
// prisma/migrations/YYYYMMDDHHMMSS_description/migration.sql

-- Up Migration
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
CREATE INDEX idx_users_phone ON users(phone);

-- Down Migration (in separate file or commented)
-- DROP INDEX idx_users_phone;
-- ALTER TABLE users DROP COLUMN phone;
```

### Data Migration Pattern

```typescript
// For complex data migrations, use a script
async function migrateData() {
  const batchSize = 1000;
  let offset = 0;
  let processed = 0;

  while (true) {
    const batch = await db.query(
      'SELECT * FROM old_table LIMIT $1 OFFSET $2',
      [batchSize, offset]
    );

    if (batch.length === 0) break;

    for (const row of batch) {
      await db.query(
        'INSERT INTO new_table (...) VALUES (...)',
        [transformData(row)]
      );
      processed++;
    }

    console.log(`Processed ${processed} rows`);
    offset += batchSize;
  }
}
```

---

## Phase 4: Testing

### Migration Testing

```bash
> "@tester test migration thoroughly:

   Test scenarios:
   1. Fresh database apply
   2. Existing database apply
   3. Rollback
   4. Re-apply after rollback
   5. Data integrity after migration
   6. Application compatibility
   7. Performance impact"
# Output: docs/test-reports/YYYY-MM-DD-migration-[name].md
```

### Testing Checklist

- [ ] Migration applies successfully on empty database
- [ ] Migration applies successfully on populated database
- [ ] Rollback works correctly
- [ ] Data integrity maintained after migration
- [ ] Application works with new schema
- [ ] Performance acceptable after migration
- [ ] Edge cases handled (nulls, special characters, etc.)

### Test Commands

```bash
# Apply migration
npm run db:migrate

# Verify
npm run db:verify

# Rollback
npm run db:rollback

# Re-apply
npm run db:migrate
```

---

## Phase 5: Deployment

### Pre-Deployment Checklist

```bash
> "@tester verify pre-deployment:
   - [ ] Backup taken
   - [ ] Staging migration successful
   - [ ] Rollback tested
   - [ ] Team notified
   - [ ] Monitoring dashboards ready"
```

### Deployment Steps

#### Zero-Downtime Migration

```bash
# 1. Deploy new code that supports both old and new schema
> "@git-manager deploy code with dual-schema support"

# 2. Run migration
> "@database-admin apply migration"

# 3. Verify
> "@tester verify migration success"

# 4. Deploy code that only uses new schema
> "@git-manager deploy code for new schema only"

# 5. Cleanup old schema (later, separate deployment)
> "@database-admin remove deprecated schema elements"
```

#### Maintenance Window Migration

```bash
# 1. Enable maintenance mode
> "Enable maintenance mode on application"

# 2. Take backup
> "@database-admin backup database before migration"

# 3. Run migration
> "@database-admin apply migration"

# 4. Verify
> "@tester run smoke tests"

# 5. Disable maintenance mode
> "Disable maintenance mode"

# 6. Monitor
> "Watch error rates and performance metrics"
```

### Post-Deployment Verification

```bash
> "@tester post-migration verification:
   - [ ] Application healthy
   - [ ] No error spike
   - [ ] Performance normal
   - [ ] Data accessible
   - [ ] Dependent services working"
```

---

## Phase 6: API Migration

### API Versioning Strategy

```bash
> "@architect design API versioning for [CHANGE]:

   Current: /api/v1/users
   Target: /api/v2/users

   Questions:
   1. What's changing?
   2. Is it backward compatible?
   3. How long to support v1?
   4. How to migrate clients?"
# Output: docs/architecture/YYYY-MM-DD-api-v2-migration.md
```

### API Migration Pattern

```typescript
// Support both versions during transition
router.get('/api/v1/users/:id', handleV1GetUser);
router.get('/api/v2/users/:id', handleV2GetUser);

// Add deprecation header to v1
function handleV1GetUser(req, res, next) {
  res.set('Deprecation', 'true');
  res.set('Sunset', '2025-06-01');
  res.set('Link', '</api/v2/users>; rel="successor-version"');

  // Handle request...
}
```

### Client Migration Communication

```markdown
## API v2 Migration Guide

### Timeline
- **Now**: v2 available, v1 deprecated
- **2025-06-01**: v1 sunset (removed)

### Breaking Changes
1. [Change 1]: [Description] - [Migration steps]
2. [Change 2]: [Description] - [Migration steps]

### Migration Steps
1. Update client to support v2
2. Test against v2 endpoints
3. Switch to v2
4. Remove v1 code
```

---

## Rollback Procedures

### Database Rollback

```bash
# If migration fails
> "@database-admin rollback migration:
   1. Stop application traffic
   2. Run DOWN migration
   3. Verify data integrity
   4. Restore application traffic
   5. Investigate failure"
```

### Point-in-Time Recovery

```bash
# If rollback script fails
> "@database-admin restore from backup:
   1. Restore to point before migration
   2. Verify data
   3. Investigate and fix migration
   4. Re-attempt"
```

### API Rollback

```bash
# If v2 has issues
> "@git-manager revert API changes:
   1. Redirect traffic to v1
   2. Disable v2 endpoints
   3. Communicate to clients
   4. Fix and re-deploy v2"
```

---

## Migration Checklist

### Planning
- [ ] Change documented and approved
- [ ] Risk level assessed
- [ ] Rollback strategy defined
- [ ] Timeline established
- [ ] Stakeholders notified

### Development
- [ ] Migration files created
- [ ] UP and DOWN migrations work
- [ ] Data migration script (if needed)
- [ ] Verification queries ready

### Testing
- [ ] Tested on empty database
- [ ] Tested on staging with real data
- [ ] Rollback tested
- [ ] Performance verified
- [ ] Application compatibility verified

### Deployment
- [ ] Backup completed
- [ ] Team on standby
- [ ] Monitoring ready
- [ ] Migration applied
- [ ] Verification passed
- [ ] Rollback plan ready

### Post-Deployment
- [ ] Application healthy
- [ ] No error spikes
- [ ] Performance normal
- [ ] Documentation updated
- [ ] Clients notified (if API change)

---

## Common Patterns

### Pattern 1: Add Nullable Column

```sql
-- LOW RISK: Can be done with zero downtime
ALTER TABLE users ADD COLUMN middle_name VARCHAR(100);
```

### Pattern 2: Add Required Column with Default

```sql
-- MEDIUM RISK: Watch for lock time on large tables
ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
```

### Pattern 3: Rename Column (Zero Downtime)

```sql
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN email_address VARCHAR(255);

-- Step 2: Backfill data
UPDATE users SET email_address = email;

-- Step 3: Deploy app using new column

-- Step 4: Drop old column (separate migration, later)
ALTER TABLE users DROP COLUMN email;
```

### Pattern 4: Change Data Type

```sql
-- Add new column
ALTER TABLE orders ADD COLUMN amount_new DECIMAL(10,2);

-- Backfill with conversion
UPDATE orders SET amount_new = amount::DECIMAL(10,2);

-- Deploy app using new column

-- Drop old column (later)
ALTER TABLE orders DROP COLUMN amount;
ALTER TABLE orders RENAME COLUMN amount_new TO amount;
```

---

## Anti-Patterns (Avoid)

| Don't | Instead |
|-------|---------|
| Run migrations without backup | Always backup first |
| Skip testing on staging | Test with production-like data |
| Deploy during peak hours | Use off-peak times |
| Mix schema and data migrations | Separate into distinct migrations |
| Skip rollback testing | Always verify rollback works |
| Rush large migrations | Plan carefully, execute methodically |

---

*Template for database and API migrations. Last updated: 2025-01-11*
