# Project Configuration

> This file provides project context for all agents. Update when project settings change.

---

## Project Overview

| Field | Value |
|-------|-------|
| **Name** | [Project Name] |
| **Type** | Web Application / API / CLI / Library |
| **Stage** | Development / Staging / Production |
| **Team Size** | [Number] |

---

## Tech Stack

### Core

| Category | Technology | Version |
|----------|------------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20.x LTS |
| Package Manager | npm | 10.x |

### Backend

| Category | Technology | Notes |
|----------|------------|-------|
| Framework | Express | REST API |
| Database | PostgreSQL | Primary data store |
| ORM | Prisma | Type-safe queries |
| Cache | Redis | Session, caching |
| Queue | Bull | Background jobs |

### Frontend (if applicable)

| Category | Technology | Notes |
|----------|------------|-------|
| Framework | React | 18.x |
| State | Zustand / Redux | [Choice] |
| Styling | Tailwind CSS | Utility-first |
| Build | Vite | Fast builds |

### Testing

| Category | Technology | Notes |
|----------|------------|-------|
| Unit Tests | Jest | With ts-jest |
| Integration | Supertest | API testing |
| E2E | Playwright | Browser testing |
| Coverage | Istanbul | Via Jest |

### DevOps

| Category | Technology | Notes |
|----------|------------|-------|
| CI/CD | GitHub Actions | .github/workflows/ |
| Container | Docker | Multi-stage builds |
| Hosting | [AWS/GCP/Vercel] | [Details] |
| Monitoring | [Datadog/Sentry] | [Details] |

---

## Architecture Pattern

### Style
- [ ] Monolith
- [x] Layered (Controller → Service → Repository)
- [ ] Microservices
- [ ] Serverless

### Directory Structure

```
src/
├── api/              # HTTP layer (controllers, routes)
├── core/             # Business logic (services)
├── infrastructure/   # External services (db, cache, email)
├── shared/           # Utilities, types, constants
└── index.ts          # Entry point
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Files | kebab-case | `user-service.ts` |
| Classes | PascalCase | `UserService` |
| Functions | camelCase | `getUserById` |
| Constants | UPPER_SNAKE | `MAX_RETRIES` |
| Interfaces | PascalCase | `UserDTO` |
| Types | PascalCase | `AuthResult` |

---

## API Standards

### Style
- [x] REST
- [ ] GraphQL
- [ ] gRPC

### Conventions

| Aspect | Convention |
|--------|------------|
| Versioning | URL prefix: `/api/v1/` |
| Naming | Plural nouns: `/users`, `/orders` |
| Response | `{ success, data, error }` wrapper |
| Errors | Standard error codes with messages |
| Auth | Bearer token in Authorization header |

### Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## Authentication & Authorization

### Method
- [x] JWT with refresh tokens
- [ ] Session-based
- [ ] OAuth 2.0
- [ ] API Keys

### Token Configuration

| Setting | Value |
|---------|-------|
| Access Token Expiry | 15 minutes |
| Refresh Token Expiry | 7 days |
| Algorithm | RS256 / HS256 |
| Storage | HttpOnly cookies / localStorage |

### Authorization Model
- [ ] Simple (authenticated/not)
- [x] Role-based (RBAC)
- [ ] Attribute-based (ABAC)
- [ ] Permission-based

---

## Database

### Primary Database

| Setting | Value |
|---------|-------|
| Type | PostgreSQL |
| Version | 15.x |
| Connection | Pool (max: 20) |

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Tables | snake_case, plural | `user_preferences` |
| Columns | snake_case | `created_at` |
| Primary Keys | `id` (UUID) | `id UUID PRIMARY KEY` |
| Foreign Keys | `[table]_id` | `user_id` |
| Indexes | `idx_[table]_[columns]` | `idx_users_email` |

### Migration Rules
- Always include rollback (DOWN)
- Use transactions
- Test on staging first
- No data loss migrations without backup

---

## Quality Gates

### Code Quality

| Check | Threshold | Command |
|-------|-----------|---------|
| TypeScript | Strict mode, no errors | `npm run typecheck` |
| ESLint | No errors, max 10 warnings | `npm run lint` |
| Prettier | Formatted | `npm run format:check` |

### Test Quality

| Metric | Threshold | Command |
|--------|-----------|---------|
| Line Coverage | ≥ 80% | `npm run test:cov` |
| Branch Coverage | ≥ 70% | `npm run test:cov` |
| All Tests Pass | 100% | `npm test` |

### Performance

| Metric | Threshold |
|--------|-----------|
| API Response Time (p95) | < 200ms |
| Database Query Time | < 50ms |
| Bundle Size (frontend) | < 500KB gzipped |

### Security

| Check | Requirement |
|-------|-------------|
| Dependency Audit | No critical/high vulnerabilities |
| Secret Scanning | No secrets in code |
| OWASP Top 10 | All mitigated |

---

## Environment Configuration

### Environments

| Environment | Purpose | Branch |
|-------------|---------|--------|
| Development | Local dev | feature/* |
| Staging | Pre-prod testing | develop |
| Production | Live | main |

### Required Environment Variables

```bash
# Application
NODE_ENV=development|staging|production
PORT=3000
LOG_LEVEL=debug|info|warn|error

# Database
DATABASE_URL=postgres://user:pass@host:5432/db

# Authentication
JWT_SECRET=<secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<secret>
REFRESH_TOKEN_EXPIRES_IN=7d

# Redis (optional)
REDIS_URL=redis://localhost:6379

# External Services
# STRIPE_KEY=sk_...
# SENDGRID_KEY=SG...
```

### Secrets Management
- Never commit secrets
- Use `.env.example` for templates
- Store in GitHub Secrets / AWS Secrets Manager
- Rotate regularly

---

## Git Workflow

### Branch Strategy

| Branch | Purpose | Merges To |
|--------|---------|-----------|
| `main` | Production | - |
| `develop` | Integration | `main` |
| `feat/*` | Features | `develop` |
| `fix/*` | Bug fixes | `develop` |
| `hotfix/*` | Urgent fixes | `main` + `develop` |

### Commit Conventions

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore, perf
Scope: module/feature area
Description: imperative mood, lowercase
```

### PR Requirements
- [ ] All CI checks pass
- [ ] At least 1 approval
- [ ] No unresolved comments
- [ ] Up to date with target branch

---

## Deployment

### CI/CD Pipeline

```
Push → Lint → TypeCheck → Test → Build → Deploy
```

### Deployment Strategy
- [x] Rolling deployment
- [ ] Blue-green
- [ ] Canary

### Rollback Plan
1. Revert to previous Docker image tag
2. Run database rollback if needed
3. Verify health checks
4. Notify team

---

## Monitoring & Logging

### Logging

| Level | Usage |
|-------|-------|
| ERROR | Exceptions, failures |
| WARN | Unusual but handled |
| INFO | Business events |
| DEBUG | Development only |

### Logging Rules
- No PII in logs
- Structured JSON format
- Include correlation IDs
- Log security events

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic health |
| `GET /health/ready` | Readiness (dependencies) |
| `GET /health/live` | Liveness |

---

## Documentation Standards

### Code Documentation
- JSDoc for public APIs
- Inline comments for complex logic only
- Self-documenting code preferred

### API Documentation
- OpenAPI/Swagger spec
- Examples for all endpoints
- Error responses documented

### Project Documentation

| Doc | Location | Purpose |
|-----|----------|---------|
| README.md | Root | Quick start, overview |
| CLAUDE.md | Root | AI agent instructions |
| CHANGELOG.md | Root | Version history |
| docs/api/ | docs/ | API documentation |
| docs/architecture/ | docs/ | System design |

---

## Agent-Specific Settings

### Agent Output Locations

| Agent | Output Directory |
|-------|------------------|
| @brainstormer | `docs/decisions/` |
| @architect | `docs/architecture/` |
| @planner | `docs/plans/` |
| @researcher | `docs/research/` |
| @tester | `docs/test-reports/` |
| @code-reviewer | `docs/code-reviews/` |
| @debugger | `docs/debug-reports/` |
| @ui-ux-designer | `docs/design-reports/` |
| @database-admin | `docs/database/` |
| @security-auditor | `docs/security/` |
| @devops | `docs/devops/` |
| @docs-manager | `docs/`, `README.md` |

### File Naming Convention
```
docs/[type]/YYYY-MM-DD-[topic]-[type].md
```

Example: `docs/decisions/2025-01-11-auth-method-decision.md`

---

## Quick Reference Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm start                # Start production

# Quality
npm run typecheck        # TypeScript check
npm run lint             # ESLint
npm run lint:fix         # Fix lint issues
npm run format           # Prettier format

# Testing
npm test                 # Run tests
npm run test:cov         # With coverage
npm run test:watch       # Watch mode

# Database
npm run db:migrate       # Run migrations
npm run db:rollback      # Rollback migration
npm run db:seed          # Seed data
npm run db:reset         # Reset database

# Docker
docker compose up        # Start services
docker compose down      # Stop services
docker compose logs -f   # View logs
```

---

## Notes & Customization

> Add project-specific notes here that agents should be aware of.

### Project-Specific Rules
- [Add custom rules]

### Known Issues
- [Document known issues]

### Technical Debt
- [Track tech debt items]

---

*Last updated: YYYY-MM-DD*
*Update this file when project configuration changes*
