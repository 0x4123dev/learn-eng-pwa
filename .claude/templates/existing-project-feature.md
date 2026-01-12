# Template: Feature Development in Existing Project

> Use this template when adding a feature to an unfamiliar or complex existing codebase

---

## Quick Start

Copy and paste this workflow:

```bash
# Step 1: Explore the codebase
"@scout explore this project - show structure, tech stack, patterns, and conventions"

# Step 2: Research relevant areas
"@scout find files related to [FEATURE_AREA]. Show how similar features are implemented."

# Step 3: Understand existing patterns
"@researcher analyze patterns used in this codebase for:
- Error handling
- Data access
- API structure
- Testing approach"

# Step 4: Document findings (optional but recommended)
"@docs-manager create docs/research/[DATE]-codebase-analysis.md with findings"

# Step 5: Decide approach based on existing patterns
"@brainstormer explore options for [FEATURE_NAME]:
- Follow existing patterns found in codebase
- Consider integration points identified
- Evaluate trade-offs"

# Step 6: Create implementation plan
"@planner create plan from docs/decisions/[DATE]-[FEATURE]-decision.md
Following patterns from: [identified patterns]"

# Step 7: Implement following existing conventions
"@senior-developer implement Phase 1 from docs/plans/[DATE]-[FEATURE]-plan.md
Match existing code style and patterns."

# Step 8: Test (follow existing test patterns)
"@tester write tests for Phase 1 following existing test conventions"

# Step 9: Repeat steps 7-8 for remaining phases

# Step 10: Code review
"@code-reviewer review [FEATURE_NAME] for:
- Consistency with existing codebase
- Following established patterns"

# Step 11: Commit
"@git-manager commit and create PR for [FEATURE_NAME]"
```

---

## Detailed Workflow

### Phase 1: Codebase Exploration

**Goal**: Understand the project before making changes

```bash
# High-level overview
"@scout explore this project:
- Directory structure
- Tech stack and dependencies
- Main entry points
- Configuration files"

# Find related code
"@scout find code related to [FEATURE_AREA]:
- Similar features
- Related modules
- Integration points"
```

**Key Questions to Answer**:
- What framework/libraries are used?
- How is the project structured?
- Where do similar features live?
- What patterns are established?

**Output**: Mental model of codebase (or `docs/research/YYYY-MM-DD-codebase-analysis.md`)

---

### Phase 2: Pattern Discovery

**Goal**: Learn established conventions to follow them

```bash
# Analyze patterns
"@researcher analyze this codebase's patterns:
- How are services structured?
- How is data accessed?
- How are APIs defined?
- How are errors handled?
- How are tests written?"

# Look at similar implementations
"@scout show implementation of [SIMILAR_FEATURE] as reference"
```

**Common Patterns to Identify**:

| Area | Questions |
|------|-----------|
| Services | Dependency injection? Singleton? Factory? |
| Data | Repository pattern? ORM? Raw queries? |
| API | REST? GraphQL? RPC? Middleware chain? |
| Errors | Custom classes? Error codes? How logged? |
| Tests | Framework? Mocking approach? Fixtures? |
| Config | Environment? Config files? Feature flags? |

**Output**: List of patterns to follow

---

### Phase 3: Integration Point Analysis

**Goal**: Identify where new code connects to existing code

```bash
"@scout identify integration points for [FEATURE_NAME]:
- Which existing services to use?
- Which existing APIs to extend?
- Which existing types/models to reuse?
- Database tables involved?"
```

**Map the connections**:
```
New Feature
├── Uses: ExistingServiceA
├── Extends: ExistingControllerB
├── Shares: ExistingTypeC
└── Modifies: ExistingTableD
```

---

### Phase 4: Decision Making

**Goal**: Choose approach based on codebase knowledge

```bash
"@brainstormer decide approach for [FEATURE_NAME]:
- Option A: [following pattern X from codebase]
- Option B: [following pattern Y from codebase]

Context:
- Existing patterns: [list discovered patterns]
- Integration points: [list identified points]
- Constraints: [any limitations found]"
```

**Output**: `docs/decisions/YYYY-MM-DD-[feature]-decision.md`

---

### Phase 5: Planning

**Goal**: Create plan that respects existing architecture

```bash
"@planner create implementation plan for [FEATURE_NAME]:
- Follow patterns from: [patterns document/notes]
- Integrate with: [identified integration points]
- Reuse: [existing components to leverage]
- Match conventions: [coding style, naming, etc.]"
```

**Output**: `docs/plans/YYYY-MM-DD-[feature]-plan.md`

---

### Phase 6: Implementation

**Goal**: Write code that fits naturally into existing codebase

```bash
# Implement following established patterns
"@senior-developer implement Phase 1 from docs/plans/[DATE]-[FEATURE]-plan.md

Guidelines:
- Follow existing code style
- Use established patterns
- Reuse existing utilities
- Match naming conventions"

# Test following existing test patterns
"@tester write tests for Phase 1 using project's test conventions"
```

**Output**: Source code matching existing style

---

### Phase 7: Consistency Review

**Goal**: Ensure new code fits with existing code

```bash
"@code-reviewer review [FEATURE_NAME]:
- Does it follow established patterns?
- Is naming consistent?
- Does it use existing utilities?
- Is test style consistent?
- Any unnecessary divergence?"
```

**Output**: `docs/code-reviews/YYYY-MM-DD-[feature].md`

---

### Phase 8: Finalize

**Goal**: Commit and document

```bash
# Fix any consistency issues
"@senior-developer fix issues from docs/code-reviews/[DATE]-[FEATURE].md"

# Commit
"@git-manager commit and create PR for [FEATURE_NAME]"
```

---

## Exploration Checklist

Before writing any code, answer:

### Project Structure
- [ ] What is the directory structure?
- [ ] Where does business logic live?
- [ ] Where do API routes live?
- [ ] Where do tests live?

### Tech Stack
- [ ] What language/framework version?
- [ ] What key dependencies?
- [ ] What build tools?
- [ ] What test framework?

### Patterns
- [ ] How are services structured?
- [ ] How is data accessed?
- [ ] How are errors handled?
- [ ] How is authentication done?
- [ ] How is validation done?

### Conventions
- [ ] File naming convention?
- [ ] Function naming convention?
- [ ] Import organization?
- [ ] Comment style?

### Integration
- [ ] What existing code to reuse?
- [ ] What existing code to extend?
- [ ] What existing types/models?

---

## Example: Adding User Preferences to Existing App

```bash
# 1. Explore codebase
"@scout explore this project structure and tech stack"
# Found: Express + TypeORM + Jest, Repository pattern, REST API

# 2. Find related code
"@scout find how user-related features are implemented"
# Found: UserService, UserRepository, UserController patterns

# 3. Analyze patterns
"@researcher show how existing entities and repositories work"
# Found: Base entity with timestamps, repository extends BaseRepository

# 4. Decide approach
"@brainstormer adding user preferences:
Following existing patterns:
- Create PreferencesEntity extending BaseEntity
- Create PreferencesRepository extending BaseRepository
- Create PreferencesService like UserService
- Add to existing UserController"

# 5. Plan
"@planner create plan following existing user module patterns:
Phase 1: PreferencesEntity + migration
Phase 2: PreferencesRepository
Phase 3: PreferencesService
Phase 4: API endpoints in UserController
Phase 5: Tests following existing user tests"

# 6. Implement (matching existing style)
"@senior-developer implement Phase 1: PreferencesEntity
Match UserEntity style and conventions"
"@tester write tests matching existing entity tests"

# Continue phases...

# 7. Review for consistency
"@code-reviewer review preferences feature:
- Matches existing user module patterns?
- Consistent naming?
- Test style matches?"

# 8. Commit
"@git-manager commit 'feat(users): add user preferences'"
```

---

## When to Use This Template

Use this template when:
- Joining an existing project
- Working on unfamiliar codebase
- Adding feature to complex system
- Need to maintain consistency with existing code
- Project has established patterns to follow

Use `new-feature.md` instead when:
- Starting greenfield project
- You're familiar with codebase
- No established patterns to follow
- Simple, isolated feature

---

## Anti-Patterns (What NOT to Do)

| Anti-Pattern | Why It's Bad | Instead Do |
|--------------|--------------|------------|
| Skip exploration | Code won't fit | Explore first |
| Ignore existing patterns | Inconsistent codebase | Match patterns |
| Reinvent utilities | Duplicate code | Reuse existing |
| Different naming style | Confusing | Match conventions |
| Skip consistency review | Technical debt | Review for fit |

---

*Template for feature development in existing projects*
