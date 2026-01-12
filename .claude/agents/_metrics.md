# Agent Metrics & Logging Guidelines

> Track agent usage, measure effectiveness, and improve workflows

---

## Overview

This document defines how to track and measure agent performance to continuously improve the development workflow.

---

## Metrics to Track

### 1. Usage Metrics

| Metric | What to Track | Why |
|--------|---------------|-----|
| Invocation Count | How often each agent is called | Identify most/least used agents |
| Session Duration | Time spent in each agent | Optimize agent efficiency |
| Handoff Success | Completed handoff chains | Validate workflow design |
| Error Rate | Failed operations per agent | Identify reliability issues |

### 2. Quality Metrics

| Metric | What to Track | Why |
|--------|---------------|-----|
| Output Acceptance | % of outputs accepted without changes | Measure agent accuracy |
| Revision Cycles | Times output was revised | Identify improvement areas |
| Review Findings | Issues found by @code-reviewer | Track code quality trends |
| Test Pass Rate | First-time test success | Measure implementation quality |

### 3. Workflow Metrics

| Metric | What to Track | Why |
|--------|---------------|-----|
| Pipeline Completion | % of features through full workflow | Validate process adherence |
| Bottleneck Detection | Where workflows stall | Optimize handoffs |
| Skip Rate | When agents are bypassed | Identify unnecessary steps |
| Cycle Time | Time from decision to merged code | Measure overall efficiency |

---

## Logging Format

### Session Log Template

Create session logs in `docs/metrics/` for major features:

```markdown
# Session Log: [Feature Name]

**Date**: YYYY-MM-DD
**Duration**: Xh Ym

## Agent Usage

| Agent | Invocations | Outputs | Revisions |
|-------|-------------|---------|-----------|
| @brainstormer | 1 | 1 decision | 0 |
| @planner | 1 | 1 plan | 1 |
| @senior-developer | 3 | 5 files | 2 |
| @tester | 2 | 1 report | 0 |
| @code-reviewer | 2 | 1 approved | 1 |
| @git-manager | 1 | 1 commit | 0 |

## Workflow

```
@brainstormer (15m) → @planner (20m) → @senior-developer (2h) →
@tester (30m) → @code-reviewer (15m) → fix → @code-reviewer (10m) →
@git-manager (5m)
```

## Issues Encountered

| Issue | Agent | Resolution |
|-------|-------|------------|
| Missing test case | @tester | Added after review |
| N+1 query | @code-reviewer | Fixed by @senior-developer |

## Retrospective

**What worked well**:
- Decision doc prevented rework
- Plan was accurate

**What could improve**:
- Test cases missed edge case
- Should have run @security-auditor

**Next time**:
- Add security audit for auth features
```

---

## Automated Tracking

### Git Commit Analysis

Track agent-generated commits by message prefix:

```bash
# Count commits by type
git log --oneline --since="1 month ago" | grep -c "feat:"
git log --oneline --since="1 month ago" | grep -c "fix:"
git log --oneline --since="1 month ago" | grep -c "refactor:"

# Count agent-generated commits
git log --oneline --since="1 month ago" | grep -c "Claude Code"
```

### Document Analysis

```bash
# Count outputs by agent
ls docs/decisions/ | wc -l      # @brainstormer
ls docs/plans/ | wc -l          # @planner
ls docs/research/ | wc -l       # @researcher
ls docs/architecture/ | wc -l   # @architect
ls docs/test-reports/ | wc -l   # @tester
ls docs/code-reviews/ | wc -l   # @code-reviewer
ls docs/debug-reports/ | wc -l  # @debugger
ls docs/security/ | wc -l       # @security-auditor
ls docs/performance/ | wc -l    # @performance-engineer
ls docs/design-reports/ | wc -l # @ui-ux-designer
ls docs/database/ | wc -l       # @database-admin
ls docs/devops/ | wc -l         # @devops
```

---

## Weekly Review Template

```markdown
# Weekly Metrics Review: YYYY-MM-DD

## Summary

| Metric | This Week | Last Week | Trend |
|--------|-----------|-----------|-------|
| Features Completed | X | Y | ↑/↓ |
| Bugs Fixed | X | Y | ↑/↓ |
| Review Pass Rate | X% | Y% | ↑/↓ |
| Avg Cycle Time | Xh | Yh | ↑/↓ |

## Agent Performance

| Agent | Usage | Success Rate | Notes |
|-------|-------|--------------|-------|
| @brainstormer | 5 | 100% | - |
| @planner | 5 | 100% | - |
| @senior-developer | 12 | 92% | 1 revision needed |
| @tester | 8 | 100% | - |
| @code-reviewer | 10 | 80% | 2 rejections |

## Issues & Actions

| Issue | Impact | Action |
|-------|--------|--------|
| [Issue] | [Impact] | [What to do] |

## Next Week Focus

- [ ] [Action item]
```

---

## Improvement Process

### Monthly Analysis

1. **Collect Data**: Gather all session logs and git metrics
2. **Identify Patterns**: Look for recurring issues
3. **Prioritize Improvements**: Rank by impact
4. **Update Agents**: Modify agent definitions as needed
5. **Track Results**: Measure improvement next month

### Agent Improvement Triggers

| Trigger | Action |
|---------|--------|
| Error rate > 20% | Review agent instructions |
| Low usage | Consider merging or removing |
| High revision rate | Add examples/constraints |
| Frequent skips | Simplify or remove agent |
| Bottleneck | Optimize handoff process |

---

## Dashboards (Optional)

If using a metrics dashboard, track:

```yaml
# Suggested Grafana/DataDog metrics
agent_invocations_total{agent="name"}
agent_duration_seconds{agent="name"}
agent_errors_total{agent="name"}
workflow_completion_rate
handoff_success_rate
```

---

## Best Practices

### Do

- Log every major feature workflow
- Review metrics weekly
- Update agents based on data
- Share learnings with team

### Don't

- Over-engineer tracking
- Ignore negative trends
- Skip retrospectives
- Treat metrics as punishment

---

*Metrics guidelines for 16-agent system. Last updated: 2025-01-11*
