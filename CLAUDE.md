# CLAUDE.md - Project Instructions

> This file provides context and instructions for Claude Code CLI when working on this project.

---

## File Operations

Write files with the **Write** tool, or with an ordinary shell redirect
(`cat > file << 'EOF'`) — both persist. Prefer Write for anything long: it is
atomic, it does not go through shell quoting, and a heredoc containing
backticks or `$` will bite you.

An older version of this file claimed Bash writes "run in a sandbox and DO NOT
PERSIST". That was not true, and it sent agents down a much slower path for
routine edits. (It also gave an example path in `app-analyzer`, a different
repository entirely.) This project lives at
`/Users/chuzon/go/src/learn-eng-pwa`.

---

## Quick Reference

There is exactly ONE npm script. This is a vanilla-JS PWA — no build step, no
bundler, no TypeScript, no linter.

```bash
npm test          # the whole suite (12,700+ tests, tests/run-all.js)
npm run verify    # "is any feature broken?" — see below
npm run verify -- --live       # …including on the deployed site
node tests/foo.test.js          # one file — see the WARNING below
scripts/deploy-pages.sh -m "msg"  # bump the 4 version markers, test, commit, push → GitHub Pages (THE deploy)
scripts/deploy-api.sh           # the API: Cloudflare Pages `learn-eng-pwa-api` + Worker `learn-eng-pwa-battle`
scripts/api-db-init.sh          # build the D1 `learn_eng_pwa_db` from scratch (schema + migrations + auth secret)
```

**This repo is ONE of two products that share an ancestor — and they are
kept apart on purpose (decided 2026-09-21).**

| | this repo: `learn-eng-pwa` | the other: `eng-math-app` (the kids' app) |
|---|---|---|
| app | https://0x4123dev.github.io/learn-eng-pwa/ (GitHub Pages) | https://eng-pwa.pages.dev/ (Cloudflare Pages `eng-pwa`) |
| API / DB | `learn-eng-pwa-api.pages.dev` / D1 `learn_eng_pwa_db` | same origin / D1 `eng_pwa_db` |
| word audio | `audio/words/` in this repo, served by Pages | Cloudflare `eng-pwa-audio` |
| bottom bar | Home · Book 1 · Book 2 · Book 3 · Nông trại (adults learning PR English) | Home · Eng · Arena · Math · Exam (children) |
| versions | 5.x | 4.17.x |

**What this app is (since the cut of 2026-09-21):** Home (the pet dog, coins,
streak, daily tasks) · three Book tabs (Career Paths: Public Relations, the
picture-dictionary engine `js/units.js` on `js/word-data.js`) · Nông trại
(the learner's own home and farm, `js/night-raid.js` — build with coins,
plant the seeds that daily tasks earn, harvest; nobody raids anybody) ·
Profile. Everything else the ancestor had (Arena, battles, Cúng Cô Hồn,
Trung Thu, armory, raiding, Math, the Eng hub with topics/grammar/PTNK/…,
friends) is gone — do not resurrect a piece of it to "fix" a reference.

Never merge, pull or "sync" one into the other. `scripts/deploy.sh` and
`scripts/deploy-audio.sh` are the OTHER product's rituals and refuse to run
in this checkout; `wrangler.toml` files here name only this product's
resources. `js/hosting.js` still resolves `/api/` to the same origin on any
non-GitHub host — that is deliberate.

⚠️ **Do not bump version numbers by hand.** `scripts/deploy-pages.sh` rewrites
all four markers itself (js/home.js `APP_VERSION`, sw.js `CACHE_NAME`,
package.json, functions/api/version.js) and `tests/version-sync.test.js` fails
if any of them drifts. Commit your own code FIRST; the script refuses to run
with an uncommitted working tree.

**What a deploy ships:** GitHub Pages serves the source tree as it is (no
esbuild bundle). `scripts/build-sw-manifest.js` rewrites the hash values in
sw.js's `PRECACHE` block over the raw files and that sw.js goes into the
release commit. The service worker serves every manifest URL cache-first,
verifies each download against the manifest, and on an update copies
unchanged entries from the previous cache — a release downloads only what
changed. It resolves every key against the directory it was served from
(`BASE`), so the same file works at an origin root and under
`/learn-eng-pwa/`. **Adding a file the app needs offline = adding its URL to
the PRECACHE block** (hash placeholder `'0000000000000000'`; the deploy fills
it in). A push is not a deploy: deploy-pages.sh waits for the Pages build and
proves `js/home.js` is live. `functions/` changes ship separately with
`scripts/deploy-api.sh`; a new `db/*.sql` migration must be applied to
`learn_eng_pwa_db` by hand first. (Historical: `scripts/build-dist.js` and
`.cf-dist` are the other product's bundle; `tests/build-dist.test.js` still
proves the builder.)

### `npm run verify` — the independent check

`npm test` proves the code does what its author thought. `npm run verify`
proves a CHILD can still do each thing the app offers. They fail in different
ways, and the gap between them is where this project's worst bugs lived: every
one of the 52 findings in the September 2026 audit was in code with green
tests.

Four layers, in `tests/verify/`:

| layer | what it proves |
|---|---|
| `manifest.js` | every screen, route and lazy bank in the app is claimed by a named feature that says which layer verifies it |
| `server.js` | every API route, called for real against a real SQLite DB: refuses a stranger, never 5xx, money paths conserve coins |
| `client.js` | every screen rendered for real, and its primary interaction driven the way a child would |
| `live.js` | the deployed site: version matches, the service worker is the one we shipped, every startup script loads, no route answers a stranger |

**The manifest layer is what makes the rest trustworthy.** Add a tab, an API
route or a lazy bank without listing it in `tests/verify/manifest.js`, and the
run goes RED — you have to say which feature it belongs to and which layer
checks it. That is the step that was skipped when HK2 maths shipped
un-assignable for a whole semester, and when battles started writing a
`field_version` column no migration created.

A layer that cannot run reports a failure, never a skip. Silence there would
read exactly like "everything passed".

⚠️ **Only trust `npm test`.** Running one file directly is fine now that every
test file ends with `runAll().then(code => process.exit(code))`, but a file
that loses that tail exits 0 no matter what fails.

## Project Structure

```
.
├── src/                       # Source code
│   ├── api/                   # API routes/controllers
│   ├── core/                  # Business logic/services
│   ├── infrastructure/        # DB, external services
│   └── shared/                # Utilities, types, constants
├── tests/                     # Test files
├── docs/                      # Documentation
│   ├── decisions/             # @brainstormer outputs
│   ├── architecture/          # @architect outputs
│   ├── plans/                 # @planner outputs
│   ├── research/              # @researcher outputs
│   ├── design-reports/        # @ui-ux-designer outputs
│   ├── database/              # @database-admin outputs
│   ├── test-reports/          # @tester outputs
│   ├── code-reviews/          # @code-reviewer outputs
│   ├── debug-reports/         # @debugger outputs
│   ├── security/              # @security-auditor outputs
│   ├── performance/           # @performance-engineer outputs
│   ├── devops/                # @devops outputs
│   ├── api/                   # API documentation
│   └── metrics/               # Session logs and metrics
├── .claude/
│   ├── agents/                # Agent definitions (16 agents + 3 system files)
│   ├── templates/             # Workflow templates (5 templates)
│   ├── project.config.md      # Project configuration for agents
│   ├── ONBOARDING.md          # New team member guide
│   ├── CONTRIBUTING.md        # How to modify/add agents
│   ├── CHANGELOG.md           # System version history
│   ├── VERSION                # Current system version (1.0.0)
│   └── settings.local.json    # Claude Code settings
├── CLAUDE.md                  # This file
├── GUIDE.md                   # Agent usage guide
└── HANDOFF.md                 # Handoff system docs
```

---

## Agent System

### Available Agents

| Agent | Purpose | Invoke With |
|-------|---------|-------------|
| `@brainstormer` | Explore solutions, make decisions | `"@brainstormer explore options for X"` |
| `@architect` | Design system architecture | `"@architect design architecture for X"` |
| `@planner` | Create implementation plans | `"@planner create plan from docs/decisions/..."` |
| `@researcher` | Research technologies | `"@researcher best practices for X"` |
| `@scout` | Explore codebase, find files | `"@scout find files related to X"` |
| `@senior-developer` | Write production code | `"@senior-developer implement X"` |
| `@tester` | Write/run tests | `"@tester write tests for X"` |
| `@code-reviewer` | Review code quality | `"@code-reviewer review X"` |
| `@debugger` | Investigate bugs | `"@debugger investigate X"` |
| `@ui-ux-designer` | Design interfaces | `"@ui-ux-designer design X"` |
| `@database-admin` | Schema, migrations | `"@database-admin create migration for X"` |
| `@security-auditor` | Security vulnerabilities | `"@security-auditor audit X"` |
| `@performance-engineer` | Performance optimization | `"@performance-engineer analyze X"` |
| `@devops` | CI/CD, Docker | `"@devops setup X"` |
| `@docs-manager` | Documentation | `"@docs-manager update README"` |
| `@git-manager` | Git operations | `"@git-manager commit and push"` |

### Workflow Patterns

```
Feature Development (Simple):
@brainstormer → @planner → @senior-developer → @tester → @code-reviewer → @git-manager

Feature Development (Complex):
@brainstormer → @architect → @planner → @senior-developer → @tester → @code-reviewer → @git-manager

Feature in Existing Project (unfamiliar codebase):
@scout → @researcher → @brainstormer → @planner → @senior-developer → @tester → @code-reviewer → @git-manager

Bug Fix:
@debugger → @senior-developer → @tester → @git-manager

Refactor:
@scout → @tester → @planner → @senior-developer → @tester → @git-manager

UI Component:
@researcher → @ui-ux-designer → @senior-developer → @tester → @git-manager

Database Change:
@brainstormer → @database-admin → @senior-developer → @tester → @git-manager

Security Audit:
@security-auditor → @senior-developer → @tester → @git-manager

Microservice/Complex Architecture:
@researcher → @brainstormer → @architect → @planner → @database-admin → @senior-developer → @tester → @security-auditor → @code-reviewer → @git-manager
```

### Handoff System

Agents save outputs to `docs/` for the next agent to read.

⚠️ **`docs/` is gitignored** (.gitignore), so these handoffs are LOCAL to one
checkout: they do not reach another clone, another worktree, or a teammate.
That is fine for passing a plan between agents inside one session; it is not a
place to record anything that must survive. Durable decisions belong in this
file, in a code comment next to the thing they explain, or in a test.


```
@brainstormer      → docs/decisions/YYYY-MM-DD-[topic]-decision.md
@architect         → docs/architecture/YYYY-MM-DD-[feature]-architecture.md
@planner           → docs/plans/YYYY-MM-DD-[feature]-plan.md
@researcher        → docs/research/YYYY-MM-DD-[topic].md
@tester            → docs/test-reports/YYYY-MM-DD-[feature].md
@code-reviewer     → docs/code-reviews/YYYY-MM-DD-[feature].md
@debugger          → docs/debug-reports/YYYY-MM-DD-[issue].md
@ui-ux-designer    → docs/design-reports/YYYY-MM-DD-[component].md
@database-admin    → docs/database/YYYY-MM-DD-[change]-migration.md
@security-auditor     → docs/security/YYYY-MM-DD-security-audit.md
@performance-engineer → docs/performance/YYYY-MM-DD-[area]-performance.md
@devops               → docs/devops/YYYY-MM-DD-[config].md
```

### Agent Collaboration

See `.claude/agents/_collaboration.md` for:
- Required handoffs between agents
- Parallel execution rules
- Quality gates

**Always reference files explicitly:**
```bash
# ✅ Good
"@planner create plan from docs/decisions/2025-01-11-auth-decision.md"

# ❌ Bad (context may be lost)
"@planner create a plan"
```

### Agent File Creation

Subagents (Agent tool, Workflow tool) CAN write files to disk, and the files
persist. Verified 2026-09-10: a probe agent wrote `data/ptnk/_probe.json` and
the file was there afterwards; the eleven PTNK transcriber agents then wrote
`data/ptnk/*.json` directly. An older version of this section claimed agent
file operations were "simulated, not executed" and required every agent to
return file contents for the main assistant to re-save. That was not true,
and for a 100 kB transcription it meant passing the whole file through the
main context twice for nothing.

**Rule**: let an agent write its own output, with an ABSOLUTE path in the
prompt, and have it verify its own work (run the validator, run the test)
before it returns. Then `ls` the path yourself — trust, but check the file
exists and is non-empty.

**When to still have an agent return content instead:** when the main
assistant needs to read and reason about it anyway (a short report, a
decision), so returning it saves a Read.

The `docs/` handoff convention (below) still holds — that directory is
gitignored, so it is a LOCAL handoff between agents in one session, never a
place to record something that must survive.

### Validation Hooks

Quality gates that MUST pass before proceeding:

#### Before Implementation (@senior-developer)
```bash
# Required checks
[ ] Decision exists: ls docs/decisions/ | grep [feature]
[ ] Plan exists: ls docs/plans/ | grep [feature]
[ ] Architecture exists (if complex): ls docs/architecture/ | grep [feature]
```

#### Before Code Review (@code-reviewer)
```bash
# Required checks — there is no typecheck and no lint in this project
npm test           # Must pass
[ ] Test report exists: ls docs/test-reports/ | grep [feature]
```

#### Before Commit (@git-manager)
```bash
# Required checks
npm test           # Must pass
[ ] Code review approved: grep -i "approved" docs/code-reviews/[feature].md
[ ] No secrets: git diff --cached | grep -iE "(api.?key|secret|password|token)" && echo "BLOCKED"
# Stage EXPLICIT paths. Another Claude session may be working in this repo;
# `git add -A` / `git add -u` swallows their work in progress.
```

#### Before Production Deploy
```bash
# Required checks
[ ] Security audit passed: ls docs/security/
[ ] All tests pass on staging
[ ] Performance baseline met
[ ] Rollback plan documented
```

### Error Recovery

See `.claude/agents/_error-recovery.md` for:
- Common error patterns and solutions
- Agent-specific recovery procedures
- Escalation paths

---

## Code Standards

### File Naming

```
kebab-case.ts          # Files
PascalCase             # Classes, interfaces, types
camelCase              # Functions, variables
UPPER_SNAKE_CASE       # Constants
```

### File Structure

```typescript
// 1. External imports
import express from 'express';
import { z } from 'zod';

// 2. Internal imports (absolute)
import { logger } from '@/shared/logger';
import { UserService } from '@/core/user.service';

// 3. Relative imports
import { validateInput } from './validators';

// 4. Types
interface CreateUserDTO {
  email: string;
  name: string;
}

// 5. Constants
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// 6. Main export
export class UserController {
  // ...
}

// 7. Helper functions (private)
function formatResponse() {
  // ...
}
```

### Error Handling

```typescript
// Use custom error classes
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

// Always use try-catch with proper logging
async function getUser(id: string): Promise<User> {
  try {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return user;
  } catch (error) {
    logger.error('Failed to get user', { id, error });
    throw error;
  }
}
```

### Service Pattern

```typescript
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}

  async createUser(dto: CreateUserDTO): Promise<User> {
    // 1. Validate
    this.validateCreateUser(dto);

    // 2. Check business rules
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ValidationError('Email already exists');
    }

    // 3. Execute
    const user = await this.userRepository.create(dto);

    // 4. Side effects
    await this.emailService.sendWelcome(user.email);

    // 5. Return
    return user;
  }
}
```

### Repository Pattern

```typescript
export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data: CreateUserDTO): Promise<User> {
    const result = await db.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [data.email, data.name]
    );
    return result.rows[0];
  }
}
```

---

## Testing Standards

### Test Structure

```typescript
describe('UserService', () => {
  let userService: UserService;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      create: jest.fn(),
    };
    userService = new UserService(mockUserRepo);
  });

  describe('createUser', () => {
    it('should create user when email is unique', async () => {
      // Arrange
      const dto = { email: 'test@example.com', name: 'Test' };
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue({ id: '1', ...dto });

      // Act
      const result = await userService.createUser(dto);

      // Assert
      expect(result.email).toBe(dto.email);
      expect(mockUserRepo.create).toHaveBeenCalledWith(dto);
    });

    it('should throw ValidationError when email exists', async () => {
      // Arrange
      const dto = { email: 'existing@example.com', name: 'Test' };
      mockUserRepo.findByEmail.mockResolvedValue({ id: '1', ...dto });

      // Act & Assert
      await expect(userService.createUser(dto))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### Test Naming

```typescript
// Pattern: should [expected behavior] when [condition]
it('should return user when id exists', async () => {});
it('should throw NotFoundError when user does not exist', async () => {});
it('should send welcome email when user is created', async () => {});
```

### Coverage Requirements

- Critical paths — anything that moves coins, decides a battle, or writes to
  D1 — must be covered by an EXECUTED test, never a substring match on source.
  See tests/money-*.test.js and tests/pages-harness.js for the pattern.
- There is no coverage tool wired up; `npm run test:cov` does not exist.

---

## Git Conventions

### Commit Messages

```
type(scope): description

# Types
feat     New feature
fix      Bug fix
docs     Documentation
style    Formatting (no code change)
refactor Code restructure
test     Adding tests
chore    Maintenance
perf     Performance
ci       CI/CD changes
build    Build system

# Examples
feat(auth): add JWT refresh endpoint
fix(orders): resolve N+1 query
docs(api): update authentication guide
refactor(users): extract validation logic
test(payments): add refund edge cases
```

### Branch Naming

```
feat/[ticket]-description     # Features
fix/[ticket]-description      # Bug fixes
refactor/description          # Refactoring
docs/description              # Documentation
chore/description             # Maintenance

# Examples
feat/AUTH-123-jwt-refresh
fix/BUG-456-login-timeout
refactor/extract-validation
```

### PR Requirements

Before creating PR:
1. ✅ All tests pass
2. ✅ Lint passes
3. ✅ Type check passes
4. ✅ Code review completed
5. ✅ Documentation updated

---

## Security Guidelines

### Never Commit

- API keys, secrets, tokens
- Passwords or credentials
- Private keys
- `.env` files (use `.env.example`)

### Always Do

- Use parameterized queries (prevent SQL injection)
- Validate and sanitize all input
- Use environment variables for secrets
- Add rate limiting to auth endpoints
- Log security events (without sensitive data)

### Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  }
}));
```

---

## Database Guidelines

### Migrations

- Always include UP and DOWN migrations
- Test rollback before deploying
- Use transactions for data migrations
- Name format: `YYYYMMDD_description.sql`

### Query Safety

```typescript
// ✅ Good - Parameterized
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ❌ Bad - SQL Injection vulnerable
const result = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

### Indexing

- Index foreign keys
- Index columns used in WHERE clauses
- Index columns used in ORDER BY
- Use EXPLAIN ANALYZE to verify

---

## Environment Setup

### Required Environment Variables

```bash
# .env.example
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/dbname

# Auth
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=15m

# Optional
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
```

### Development Setup

There is nothing to install and nothing to build. The app is static files
served from the repo root.

```bash
# Secrets (ElevenLabs for word audio) — optional, only for the audio scripts
cp .env.example .env

# Look at it: any static server over the repo root works
python3 -m http.server 8000

# The API needs D1. To run Pages Functions locally:
npx wrangler@3 pages dev . --d1 DB=eng_pwa_db
```

Database migrations are hand-applied SQL files in `db/`, newest last. Each one
carries its own `npx wrangler@3 d1 execute` line in a header comment. Apply a
migration BEFORE deploying the code that reads it.

---

## Useful Commands

```bash
# Testing — the only npm script this project has
npm test                              # the whole suite
node tests/foo.test.js                # one file
FLASHLINGO_TEST_TIMEOUT_MS=60000 npm test   # loosen the per-test timeout

# Deploy — GitHub Pages (the app) + the API's own Cloudflare projects
scripts/deploy-pages.sh -m "fix(x): …"   # bump + test + commit + push origin + wait for the Pages build
scripts/deploy-pages.sh --no-bump        # already bumped and committed
scripts/deploy-pages.sh --version 5.1.0 -m "…"
scripts/deploy-api.sh                    # functions/ → Cloudflare Pages project learn-eng-pwa-api
# (scripts/deploy.sh / deploy-audio.sh belong to the other product and refuse to run here)

# Database (hand-applied, newest file last) — THIS product's database
npx wrangler@3 d1 execute learn_eng_pwa_db --remote --file db/0NN-name.sql
npx wrangler@3 d1 execute learn_eng_pwa_db --remote --command "PRAGMA table_info(x)"
scripts/api-db-init.sh                   # a fresh database from schema + migrations

# Generated files — regenerate, never hand-edit the output
node scripts/build-word-data.js               # js/word-data.js (the three Books) from data/career-paths/pr<b>-u<NN>.json
node scripts/validate-word-data.js data/career-paths/pr1-u*.json   # the contract in data/career-paths/SCHEMA.md
node scripts/build-hot-words.js               # js/hot-words.js (from the Books' words and example sentences)
node scripts/generate-word-audio.js --tappable   # MP3s for every word + every word in an example sentence (ElevenLabs key in .env)
node scripts/build-dist.js --out /tmp/dist        # the minified bundle deploy.sh ships (size table)
node scripts/build-sw-manifest.js --check         # are sw.js's precache hashes current for this tree?
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| A test file "passes" but prints nothing | It lost its `runAll().then(code => process.exit(code))` tail. Only trust `npm test`. |
| `no such column: …` from an API test | The mock schema is built from the files listed in `tests/pages-harness.js` `SQL_FILES`. Add the migration there. |
| A tab renders empty with no error | Its bank is lazy-loaded (`js/lazy-data.js` `SCREEN_FILES`) and the download failed. Every render path must guard the global. |
| `ReferenceError: NightRaid is not defined` | The farm's CODE is lazy (`js/lazy-data.js` `GROUP_FILES.farm`, mapped to `nightRaidScreen` by `SCREEN_GROUPS`). Startup code must `typeof`-guard those names or go through `LazyData.ensure(screenId)`; `openNightRaid` is a `lazyEntry` placeholder in `js/app.js` until the group lands. Guard test: `tests/lazy-code-groups.test.js`. |
| Nông trại opens unstyled, or a new rule for it has no effect | Its CSS is lazy too: `css/night-raid.css`, listed as a `.css` entry in `js/lazy-data.js` `SCREEN_FILES` and appended as `<link>` on first open (`switchScreen` hides the screen behind `.lazy-css-pending` until then). A rule for that screen belongs in the feature file — `tests/css-split.test.js` caps `css/styles.css` and keeps the two files' selectors disjoint. Tests that ask "is X styled?" read `tests/css-all.js`, not `css/styles.css`. |
| `tests/leave-guard-contract.test.js` is red after adding a feature | Every exercise must obey the leave rule (any way out confirms; Cancel stays put; OK leaves clean). A new `isFooActive`, retry-drill key, `<div class="screen">` or `startFoo()` that draws an answer control must be registered in that file's `ACTIVITIES` with a start recipe (the test then drives it out every route for real), or allowlisted there with a one-line reason. |
| A generated file keeps reverting | It is built by a `scripts/build-*.js`; edit the source under `data/` instead. |
| Deploy refuses to run | Uncommitted changes would ship without being committed. Commit explicit paths first. |

### Debug Commands

```bash
# Check Node version
node --version  # Should be >= 18

# Check dependencies
npm ls

# Clear caches
rm -rf node_modules/.cache
npm run clean

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Documentation

### Main Guides
- **GUIDE.md** - Complete agent usage guide
- **HANDOFF.md** - Agent handoff system details
- **.claude/ONBOARDING.md** - New team member guide
- **.claude/CONTRIBUTING.md** - How to modify/add agents

### Agent System
- **.claude/agents/_collaboration.md** - Agent dependencies
- **.claude/agents/_error-recovery.md** - Error handling patterns
- **.claude/agents/_metrics.md** - Usage tracking guidelines
- **.claude/CHANGELOG.md** - System version history
- **.claude/VERSION** - Current system version

### Project Docs
- **docs/api/** - API documentation
- **docs/decisions/** - Architecture decisions
- **docs/plans/** - Implementation plans

---

## Key Reminders

1. **Use `/clear` between unrelated tasks** - Prevents context confusion
2. **Reference files explicitly** - `docs/decisions/...` not just "the decision"
3. **Test after every change** - Run `npm test` frequently
4. **Review before merge** - Always use `@code-reviewer`
5. **Commit atomically** - One logical change per commit
6. **Document decisions** - Use `@brainstormer` for major choices

---

*Last updated: 2026-01-11*