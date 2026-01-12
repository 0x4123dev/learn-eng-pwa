# CLAUDE.md - Project Instructions

> This file provides context and instructions for Claude Code CLI when working on this project.

---

## CRITICAL: File Operations Rule

⚠️ **ALL AGENTS MUST USE THE WRITE TOOL TO SAVE FILES**

```
❌ NEVER USE (does not persist):
   cat > file.md << 'EOF' ... EOF
   echo "content" > file.md
   printf '%s' "content" > file.md

✅ ALWAYS USE:
   Write tool with:
   - file_path: "/Users/chuzon/go/src/app-analyzer/docs/[folder]/file.md"
   - content: "The full file content..."
```

Bash file operations run in a sandbox and **DO NOT PERSIST** to disk.
The Write tool is the ONLY reliable method for saving files.

---

## Quick Reference

```bash
# Common commands
npm run dev                    # Start development server
npm run build                  # Production build
npm run test                   # Run tests
npm run test:cov               # Tests with coverage
npm run lint                   # Lint code
npm run typecheck              # Type check
```

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

Agents save outputs to `docs/` for the next agent to read:

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

**IMPORTANT**: Agents running via Task tool cannot directly save files to disk. Their file operations are simulated, not executed.

**Rule**: Agents must return file contents in their response for the main assistant to save.

**Agent Output Format:**
```
Save to `docs/[category]/YYYY-MM-DD-[name].md`:

[full file content here]
```

**Main Assistant Responsibility:**
After an agent completes, the main assistant MUST:
1. Extract file content from agent's response
2. Use the `Write` tool to actually save the file
3. Verify the file was created: `ls docs/[category]/`

**Example Workflow:**
```
User: "@tester write tests for auth"
Agent: Returns test code + "Save report to docs/test-reports/2025-01-11-auth.md: [content]"
Main: Uses Write tool to save docs/test-reports/2025-01-11-auth.md
Main: Confirms "Test report saved to docs/test-reports/2025-01-11-auth.md"
```

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
# Required checks
npm run typecheck  # Must pass
npm run lint       # Must pass (no errors)
npm test           # Must pass
[ ] Test report exists: ls docs/test-reports/ | grep [feature]
```

#### Before Commit (@git-manager)
```bash
# Required checks
npm run typecheck && npm run lint && npm test  # All must pass
[ ] Code review approved: grep -i "approved" docs/code-reviews/[feature].md
[ ] No secrets: git diff --cached | grep -iE "(api.?key|secret|password|token)" && echo "BLOCKED"
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

- Minimum: **80%** line coverage
- Critical paths: **100%** coverage
- Run with: `npm run test:cov`

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

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your values

# 3. Run migrations
npm run db:migrate

# 4. Start development
npm run dev
```

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Start production server

# Testing
npm test                 # Run tests
npm run test:cov         # Run tests with coverage
npm run test:watch       # Run tests in watch mode

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run typecheck        # Run TypeScript checks
npm run format           # Format with Prettier

# Database
npm run db:migrate       # Run migrations
npm run db:rollback      # Rollback last migration
npm run db:seed          # Seed database
npm run db:reset         # Reset database

# Git (via @git-manager)
"@git-manager commit"
"@git-manager commit and push"
"@git-manager create PR"
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Tests failing | Run `npm run typecheck` first |
| Import errors | Check `tsconfig.json` paths |
| DB connection | Verify `DATABASE_URL` in `.env` |
| Port in use | Change `PORT` in `.env` |

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