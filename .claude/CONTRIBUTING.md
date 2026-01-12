# Contributing to the Agent Template

> Guidelines for modifying agents, adding new agents, and improving the system

---

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Modifying Existing Agents](#modifying-existing-agents)
3. [Creating New Agents](#creating-new-agents)
4. [Adding Templates](#adding-templates)
5. [Documentation Updates](#documentation-updates)
6. [Version Management](#version-management)
7. [Testing Changes](#testing-changes)
8. [Pull Request Process](#pull-request-process)

---

## Before You Start

### Understand the System

Read these files first:
- `GUIDE.md` - Complete agent reference
- `.claude/agents/_collaboration.md` - Agent dependencies
- `.claude/agents/_error-recovery.md` - Error handling patterns

### Key Principles

1. **Consistency**: All agents follow the same structure
2. **Handoffs**: Every agent knows its inputs and outputs
3. **Recovery**: Every agent handles errors gracefully
4. **Documentation**: Changes are documented in CLAUDE.md/GUIDE.md

---

## Modifying Existing Agents

### When to Modify

- Agent output quality is poor
- Missing error handling for common cases
- Workflow changes require updates
- New project patterns need support

### Modification Process

1. **Identify the issue**: What specifically needs changing?
2. **Check dependencies**: Will this affect other agents?
3. **Update agent file**: Make changes
4. **Update version**: Bump version number
5. **Update docs**: GUIDE.md, CLAUDE.md if needed
6. **Test**: Run a sample workflow

### Required Agent Sections

Every agent MUST have:

```markdown
---
# YAML Frontmatter (required fields)
name: agent-name
version: "X.Y.Z"
last_updated: "YYYY-MM-DD"
description: >-
  What this agent does.
model: sonnet | haiku
tools:
  - Read
  - Write
  - etc.
input_from:
  - "@other-agent"
  - "user"
output_to:
  - "@next-agent"
output_location: "docs/folder/"
triggers:
  - "keyword1"
  - "keyword2"
examples:
  - user: "Example prompt"
    action: "What agent does"
---

# Agent Name

## Principles
## Process
## Output Format
## Handoff Chain
## Collaboration
## Error Recovery
## Rules
## Constraints
```

### Versioning Rules

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes to output format or workflow
MINOR: New capabilities, non-breaking changes
PATCH: Bug fixes, clarifications
```

Examples:
- `1.0.0 → 1.0.1`: Fixed typo in template
- `1.0.1 → 1.1.0`: Added new output format
- `1.1.0 → 2.0.0`: Changed handoff chain

---

## Creating New Agents

### When to Create New Agent

- Clear, distinct responsibility not covered by existing agents
- Would reduce scope of an overly-large existing agent
- New technology area needs specialized handling

### New Agent Checklist

- [ ] Unique, clear purpose
- [ ] Doesn't overlap significantly with existing agents
- [ ] Has clear inputs and outputs
- [ ] Fits into existing workflow chain
- [ ] Uses consistent structure

### Agent Template

```markdown
---
name: new-agent-name
version: "1.0.0"
last_updated: "YYYY-MM-DD"
description: >-
  Clear description of what this agent does.
  Who it helps and what it produces.
model: sonnet
tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
input_from:
  - "@previous-agent"
  - "user"
output_to:
  - "@next-agent"
output_location: "docs/category/"
triggers:
  - "keyword1"
  - "keyword2"
examples:
  - user: "Example request"
    action: "What the agent does"
---

# [Agent Name] Agent

You [role description]. Your [output type] enables [next agent/process].

## Principles

\`\`\`
PRINCIPLE1  → Description
PRINCIPLE2  → Description
PRINCIPLE3  → Description
PRINCIPLE4  → Description
\`\`\`

## When to Use

| Scenario | Use This Agent |
|----------|----------------|
| [Scenario 1] | Yes |
| [Scenario 2] | Yes |
| [Scenario 3] | No → Use @other-agent |

---

## Process

### 1. [First Step]

[Description and code examples]

### 2. [Second Step]

[Description and code examples]

### 3. Save Output

⚠️ **CRITICAL: Always save output for next agent**

---

## Output Format

### File Location
\`\`\`
docs/[category]/YYYY-MM-DD-[topic].md
\`\`\`

### Output Template

\`\`\`markdown
# [Output Type]: [Topic]

> **Date**: YYYY-MM-DD
> **Agent**: [agent-name]-agent
> **Status**: [Status options]

## Section 1

[Content]

## Section 2

[Content]

---

## Handoff

### For @next-agent:
"@next-agent [action] from docs/[category]/YYYY-MM-DD-[topic].md"

---
*[Output type] by [agent]-agent on [date]*
\`\`\`

---

## Handoff Chain

\`\`\`
@previous-agent
    │
    ▼
@this-agent (this agent)
    │
    ▼ saves
docs/[category]/YYYY-MM-DD-[topic].md
    │
    ▼ read by
@next-agent
\`\`\`

---

## Collaboration

| Input From | What |
|------------|------|
| \`@previous-agent\` | [What they provide] |
| User | [Direct requests] |

| Output To | What |
|-----------|------|
| \`@next-agent\` | [Document path] |

---

## Error Recovery

> Reference: \`.claude/agents/_error-recovery.md\`

| Error | Recovery |
|-------|----------|
| [Error 1] | [How to recover] |
| [Error 2] | [How to recover] |

**Recovery Template**:
\`\`\`markdown
⚠️ **[Issue Type]**

**Issue**: [What's blocking]

**Options**:
1. [Option 1]
2. [Option 2]
3. Ask user for guidance

Which approach?
\`\`\`

---

## Rules

| Do | Don't |
|----|-------|
| [Good practice] | [Bad practice] |
| [Good practice] | [Bad practice] |

---

## Constraints

⚠️ **[Critical constraint 1]**
⚠️ **[Critical constraint 2]**
⚠️ **[Critical constraint 3]**

Your deliverables:
1. [Deliverable 1]
2. [Deliverable 2]
3. [Deliverable 3]
```

### After Creating

1. Add to `_collaboration.md` dependency graph
2. Add to `GUIDE.md` agent table
3. Add to `CLAUDE.md` agent table
4. Create output directory: `mkdir -p docs/[category]`
5. Test with sample workflow

---

## Adding Templates

### Template Location

```
.claude/templates/[template-name].md
```

### Template Structure

```markdown
# Template: [Name]

> [One-line description]

---

## Quick Reference

\`\`\`bash
# Command sequence
"@agent1 action"
"@agent2 action"
\`\`\`

---

## When to Use

[Describe scenarios]

---

## Detailed Workflow

### Step 1: [Name]
[Details]

### Step 2: [Name]
[Details]

---

## Checklist

- [ ] Item 1
- [ ] Item 2

---

*Template for [purpose]*
```

---

## Documentation Updates

### When Updating CLAUDE.md

- New agent added/removed
- Command changes
- Workflow changes
- Project structure changes

### When Updating GUIDE.md

- New agent added/removed
- Workflow examples change
- Agent responsibilities change
- Troubleshooting additions

### When Updating HANDOFF.md

- Handoff chain changes
- New output locations
- New document types

---

## Version Management

### Agent Versions

Each agent has its own version in YAML frontmatter:

```yaml
version: "1.0.0"
last_updated: "2025-01-11"
```

### System Version

Track overall system version in `.claude/VERSION`:

```
1.0.0
```

### Version Changelog

Keep changes in `.claude/CHANGELOG.md`:

```markdown
# Agent System Changelog

## [1.0.0] - 2025-01-11

### Added
- 16 agents with full handoff support
- 5 workflow templates
- Metrics and onboarding guides

### Changed
- [Changes from previous version]

### Fixed
- [Bug fixes]
```

---

## Testing Changes

### Manual Testing

1. **Single Agent Test**
   ```bash
   > "@new-agent test prompt"
   # Verify output format and location
   ```

2. **Workflow Test**
   ```bash
   > "@brainstormer test feature"
   > "@planner create plan from [decision]"
   > "@senior-developer implement phase 1"
   # Continue through full chain
   ```

3. **Error Recovery Test**
   ```bash
   # Intentionally trigger error conditions
   # Verify recovery messages appear
   ```

### Validation Checklist

- [ ] Agent produces correct output format
- [ ] Output saved to correct location
- [ ] Handoff message is accurate
- [ ] Error recovery works
- [ ] No conflicts with other agents
- [ ] Documentation updated

---

## Pull Request Process

### PR Title Format

```
[agents] Add/Update/Fix: description
[templates] Add/Update: description
[docs] Update: description
```

### PR Description Template

```markdown
## Type of Change

- [ ] New agent
- [ ] Agent modification
- [ ] New template
- [ ] Documentation update
- [ ] Bug fix

## Description

[What changed and why]

## Testing Done

- [ ] Tested single agent
- [ ] Tested in workflow chain
- [ ] Tested error recovery

## Checklist

- [ ] Version updated
- [ ] Documentation updated
- [ ] Follows agent template structure
- [ ] No breaking changes (or documented)
```

### Review Criteria

1. **Structure**: Follows standard agent format
2. **Clarity**: Clear purpose and instructions
3. **Handoffs**: Properly integrates with chain
4. **Recovery**: Has error handling
5. **Docs**: All documentation updated

---

## Quick Reference

### File Locations

| Type | Location |
|------|----------|
| Agents | `.claude/agents/` |
| Templates | `.claude/templates/` |
| Config | `.claude/project.config.md` |
| Onboarding | `.claude/ONBOARDING.md` |
| Contributing | `.claude/CONTRIBUTING.md` |

### Required Files for New Agent

1. `.claude/agents/[name].md` - Agent definition
2. Update `_collaboration.md` - Add to graph
3. Update `GUIDE.md` - Add to tables
4. Update `CLAUDE.md` - Add to reference
5. Create `docs/[category]/` - Output directory

---

*Contributing guidelines for 16-agent system. Last updated: 2025-01-11*
