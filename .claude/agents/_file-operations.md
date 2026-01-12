# File Operations Guide for Agents

> **Version**: 1.0.0
> **Last Updated**: 2025-01-11
> **Purpose**: Ensure agents correctly persist files to the filesystem

---

## Critical Rule

⚠️ **ALWAYS use the Write tool to save files. NEVER use Bash commands for file operations.**

---

## Why This Matters

Agents run in a **sandboxed environment**. Bash commands like `cat`, `echo >`, or heredocs appear to succeed but **do not persist** to the actual filesystem.

### What Happens

```
Agent runs: cat > file.md << 'EOF' ... EOF
↓
Bash returns: exit code 0 (success)
↓
Agent thinks: "File saved successfully!"
↓
Reality: File does NOT exist on disk
```

---

## Correct Approach

### ❌ WRONG - These Don't Work

```bash
# Heredoc - DOES NOT PERSIST
cat > docs/decisions/file.md << 'EOF'
content here
EOF

# Echo redirect - DOES NOT PERSIST
echo "content" > docs/file.md

# Printf redirect - DOES NOT PERSIST
printf '%s\n' "content" > docs/file.md

# Tee command - DOES NOT PERSIST
echo "content" | tee docs/file.md
```

### ✅ CORRECT - Use the Write Tool

```
Use the Write tool with parameters:
- file_path: "/absolute/path/to/project/docs/[folder]/filename.md"
- content: "The complete file content as a string..."
```

**Example**:
```
Write tool call:
  file_path: "/Users/user/project/docs/decisions/2025-01-11-auth-decision.md"
  content: "# Decision: Authentication Method\n\n## Context\n..."
```

---

## Best Practices

### 1. Always Use Absolute Paths

```
✅ /Users/chuzon/go/src/app-analyzer/docs/decisions/file.md
❌ docs/decisions/file.md
❌ ./docs/decisions/file.md
```

### 2. Verify File Was Created

After using Write tool, optionally verify:
```bash
ls -la /path/to/file.md
```

### 3. Create Directories First (if needed)

If the directory might not exist:
```bash
mkdir -p /path/to/docs/decisions
```
Then use Write tool to create the file.

### 4. Include Full Content

The Write tool overwrites the entire file. Always provide complete content, not partial updates.

---

## Agent-Specific Paths

| Agent | Output Directory | Example Path |
|-------|------------------|--------------|
| @brainstormer | docs/decisions/ | docs/decisions/2025-01-11-topic-decision.md |
| @architect | docs/architecture/ | docs/architecture/2025-01-11-feature-architecture.md |
| @planner | docs/plans/ | docs/plans/2025-01-11-feature-plan.md |
| @researcher | docs/research/ | docs/research/2025-01-11-topic.md |
| @tester | docs/test-reports/ | docs/test-reports/2025-01-11-feature.md |
| @code-reviewer | docs/code-reviews/ | docs/code-reviews/2025-01-11-feature.md |
| @debugger | docs/debug-reports/ | docs/debug-reports/2025-01-11-issue.md |
| @ui-ux-designer | docs/design-reports/ | docs/design-reports/2025-01-11-component.md |
| @database-admin | docs/database/ | docs/database/2025-01-11-migration.md |
| @security-auditor | docs/security/ | docs/security/2025-01-11-audit.md |
| @performance-engineer | docs/performance/ | docs/performance/2025-01-11-analysis.md |
| @devops | docs/devops/ | docs/devops/2025-01-11-config.md |

---

## Troubleshooting

### File Not Found After Agent Completes

**Cause**: Agent used Bash instead of Write tool.

**Solution**:
1. Check agent output for the content
2. Manually use Write tool to save it
3. Update agent instructions to use Write tool

### Permission Denied

**Cause**: Path doesn't exist or wrong permissions.

**Solution**:
```bash
mkdir -p /path/to/directory
chmod 755 /path/to/directory
```

### Content Truncated

**Cause**: Content too long for single Write call.

**Solution**: Split into multiple files or sections.

---

## Summary

| Operation | Tool to Use |
|-----------|-------------|
| Create file | Write |
| Update file | Edit (for small changes) or Write (full replace) |
| Read file | Read |
| Delete file | Bash: `rm file` |
| Create directory | Bash: `mkdir -p dir` |
| List files | Bash: `ls` or Glob |
| Search content | Grep |

**Remember**: Write tool = persistent. Bash file writes = sandboxed (not persistent).
