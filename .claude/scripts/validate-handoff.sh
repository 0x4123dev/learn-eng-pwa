#!/bin/bash
#
# Handoff Validation Script
# Validates that required handoff documents exist before proceeding to next agent
#
# Usage:
#   ./validate-handoff.sh [feature-name]
#   ./validate-handoff.sh auth
#   ./validate-handoff.sh --check-all
#   ./validate-handoff.sh --pre-commit
#
# Exit codes:
#   0 - All validations passed
#   1 - Validation failed (missing documents)
#   2 - Invalid usage

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Icons
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"
INFO="${BLUE}ℹ${NC}"

# Configuration
DOCS_DIR="docs"
TODAY=$(date +%Y-%m-%d)

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${YELLOW}▶ $1${NC}"
    echo ""
}

check_file_exists() {
    local pattern="$1"
    local description="$2"

    if ls $pattern 1> /dev/null 2>&1; then
        local file=$(ls -t $pattern 2>/dev/null | head -1)
        echo -e "  ${CHECK} $description"
        echo -e "     └─ Found: ${BLUE}$file${NC}"
        return 0
    else
        echo -e "  ${CROSS} $description"
        echo -e "     └─ ${RED}Not found: $pattern${NC}"
        return 1
    fi
}

check_file_exists_for_feature() {
    local dir="$1"
    local feature="$2"
    local description="$3"

    local pattern="${DOCS_DIR}/${dir}/*${feature}*.md"

    if ls $pattern 1> /dev/null 2>&1; then
        local file=$(ls -t $pattern 2>/dev/null | head -1)
        echo -e "  ${CHECK} $description"
        echo -e "     └─ Found: ${BLUE}$file${NC}"
        return 0
    else
        echo -e "  ${CROSS} $description"
        echo -e "     └─ ${RED}Not found: $pattern${NC}"
        return 1
    fi
}

count_files_in_dir() {
    local dir="$1"
    if [ -d "${DOCS_DIR}/${dir}" ]; then
        ls -1 "${DOCS_DIR}/${dir}"/*.md 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

list_recent_files() {
    local dir="$1"
    local count="${2:-5}"

    if [ -d "${DOCS_DIR}/${dir}" ]; then
        ls -t "${DOCS_DIR}/${dir}"/*.md 2>/dev/null | head -$count
    fi
}

# ============================================================================
# Validation Functions
# ============================================================================

validate_before_planner() {
    local feature="$1"
    local failed=0

    print_section "Before @planner (Decision Required)"

    if ! check_file_exists_for_feature "decisions" "$feature" "Decision document exists"; then
        failed=1
        echo ""
        echo -e "  ${INFO} Recent decisions:"
        list_recent_files "decisions" 3 | while read file; do
            echo -e "     - $file"
        done
        echo ""
        echo -e "  ${WARN} Run: ${YELLOW}\"@brainstormer explore options for $feature\"${NC}"
    fi

    return $failed
}

validate_before_architect() {
    local feature="$1"
    local failed=0

    print_section "Before @architect (Decision Required)"

    if ! check_file_exists_for_feature "decisions" "$feature" "Decision document exists"; then
        failed=1
        echo ""
        echo -e "  ${WARN} Run: ${YELLOW}\"@brainstormer explore options for $feature\"${NC}"
    fi

    return $failed
}

validate_before_developer() {
    local feature="$1"
    local failed=0

    print_section "Before @senior-developer (Plan Required)"

    if ! check_file_exists_for_feature "plans" "$feature" "Plan document exists"; then
        failed=1
        echo ""
        echo -e "  ${INFO} Recent plans:"
        list_recent_files "plans" 3 | while read file; do
            echo -e "     - $file"
        done
        echo ""
        echo -e "  ${WARN} Run: ${YELLOW}\"@planner create plan for $feature\"${NC}"
    fi

    return $failed
}

validate_before_reviewer() {
    local feature="$1"
    local failed=0

    print_section "Before @code-reviewer (Tests Required)"

    if ! check_file_exists_for_feature "test-reports" "$feature" "Test report exists"; then
        failed=1
        echo ""
        echo -e "  ${WARN} Run: ${YELLOW}\"@tester write tests for $feature\"${NC}"
    fi

    # Also check that tests pass
    echo ""
    echo -e "  ${INFO} Running test suite..."
    if npm test 2>&1 | grep -q "PASS\|passed"; then
        echo -e "  ${CHECK} Tests passing"
    else
        echo -e "  ${CROSS} Tests failing"
        echo -e "     └─ ${RED}Fix tests before code review${NC}"
        failed=1
    fi

    return $failed
}

validate_before_git_manager() {
    local feature="$1"
    local failed=0

    print_section "Before @git-manager (Review Required)"

    # Check for code review
    if ! check_file_exists_for_feature "code-reviews" "$feature" "Code review exists"; then
        failed=1
        echo ""
        echo -e "  ${WARN} Run: ${YELLOW}\"@code-reviewer review $feature\"${NC}"
    else
        # Check if review is approved
        local review_file=$(ls -t ${DOCS_DIR}/code-reviews/*${feature}*.md 2>/dev/null | head -1)
        if [ -n "$review_file" ]; then
            if grep -qi "approved\|status.*approved\|verdict.*approv" "$review_file"; then
                echo -e "  ${CHECK} Code review approved"
            else
                echo -e "  ${WARN} Code review may not be approved"
                echo -e "     └─ Check: $review_file"
            fi
        fi
    fi

    # Check for secrets
    echo ""
    echo -e "  ${INFO} Checking for secrets..."
    if git diff --cached --name-only 2>/dev/null | xargs grep -l -E "(api.?key|secret|password|token|credential)" 2>/dev/null | head -5; then
        echo -e "  ${CROSS} Potential secrets detected in staged files"
        failed=1
    else
        echo -e "  ${CHECK} No obvious secrets detected"
    fi

    # Check quality gates
    echo ""
    echo -e "  ${INFO} Running quality checks..."

    if command -v npm &> /dev/null; then
        # TypeScript check
        if npm run typecheck 2>&1 | grep -q "error"; then
            echo -e "  ${CROSS} TypeScript errors found"
            failed=1
        else
            echo -e "  ${CHECK} TypeScript check passed"
        fi

        # Lint check
        if npm run lint 2>&1 | grep -q "error"; then
            echo -e "  ${CROSS} Lint errors found"
            failed=1
        else
            echo -e "  ${CHECK} Lint check passed"
        fi
    fi

    return $failed
}

validate_full_workflow() {
    local feature="$1"
    local failed=0

    print_header "Full Workflow Validation: $feature"

    # Check all stages
    echo -e "${INFO} Checking handoff chain for: ${BLUE}$feature${NC}"
    echo ""

    # Decision
    print_section "Stage 1: Decision (@brainstormer)"
    if check_file_exists_for_feature "decisions" "$feature" "Decision document"; then
        : # pass
    else
        failed=1
    fi

    # Architecture (optional)
    print_section "Stage 2: Architecture (@architect) [Optional]"
    if check_file_exists_for_feature "architecture" "$feature" "Architecture document"; then
        : # pass
    else
        echo -e "  ${INFO} No architecture doc (may not be required for simple features)"
    fi

    # Plan
    print_section "Stage 3: Plan (@planner)"
    if check_file_exists_for_feature "plans" "$feature" "Plan document"; then
        : # pass
    else
        failed=1
    fi

    # Tests
    print_section "Stage 4: Tests (@tester)"
    if check_file_exists_for_feature "test-reports" "$feature" "Test report"; then
        : # pass
    else
        failed=1
    fi

    # Review
    print_section "Stage 5: Code Review (@code-reviewer)"
    if check_file_exists_for_feature "code-reviews" "$feature" "Code review"; then
        : # pass
    else
        failed=1
    fi

    return $failed
}

check_all_directories() {
    print_header "Document Directory Status"

    echo -e "  ${INFO} Documents by type:"
    echo ""

    local dirs=("decisions" "architecture" "plans" "research" "test-reports" "code-reviews" "debug-reports" "design-reports" "database" "security" "performance" "devops")

    for dir in "${dirs[@]}"; do
        local count=$(count_files_in_dir "$dir")
        if [ "$count" -gt 0 ]; then
            echo -e "  ${CHECK} $dir: $count files"
        else
            echo -e "  ${WARN} $dir: 0 files"
        fi
    done

    echo ""
    print_section "Recent Activity (Last 5 per category)"

    for dir in "${dirs[@]}"; do
        local files=$(list_recent_files "$dir" 3)
        if [ -n "$files" ]; then
            echo -e "  ${BLUE}$dir:${NC}"
            echo "$files" | while read file; do
                echo -e "    - $(basename "$file")"
            done
            echo ""
        fi
    done
}

pre_commit_check() {
    print_header "Pre-Commit Validation"

    local failed=0

    # Get changed files
    local changed_files=$(git diff --cached --name-only 2>/dev/null)

    if [ -z "$changed_files" ]; then
        echo -e "  ${WARN} No staged changes found"
        return 0
    fi

    echo -e "  ${INFO} Staged files:"
    echo "$changed_files" | head -10 | while read file; do
        echo -e "    - $file"
    done

    # Check for code review if source files changed
    if echo "$changed_files" | grep -q "^src/"; then
        print_section "Source Changes Detected"

        # Look for any recent code review
        local today_reviews=$(ls ${DOCS_DIR}/code-reviews/${TODAY}*.md 2>/dev/null | wc -l | tr -d ' ')

        if [ "$today_reviews" -gt 0 ]; then
            echo -e "  ${CHECK} Code review found from today"
        else
            echo -e "  ${WARN} No code review from today"
            echo -e "     Consider: ${YELLOW}\"@code-reviewer review changes\"${NC}"
        fi
    fi

    # Check for test report if test files changed
    if echo "$changed_files" | grep -qE "\.test\.|\.spec\.|__tests__"; then
        print_section "Test Changes Detected"

        echo -e "  ${INFO} Verifying tests pass..."
        if npm test 2>&1 | grep -q "PASS\|passed"; then
            echo -e "  ${CHECK} Tests passing"
        else
            echo -e "  ${CROSS} Tests failing"
            failed=1
        fi
    fi

    # Secret check
    print_section "Security Check"

    local secrets_found=$(echo "$changed_files" | xargs git diff --cached 2>/dev/null | grep -iE "(api.?key|secret|password|token).*=" | head -5)

    if [ -n "$secrets_found" ]; then
        echo -e "  ${CROSS} Potential secrets in diff:"
        echo "$secrets_found" | while read line; do
            echo -e "     ${RED}$line${NC}"
        done
        failed=1
    else
        echo -e "  ${CHECK} No obvious secrets in changes"
    fi

    return $failed
}

# ============================================================================
# Usage
# ============================================================================

show_usage() {
    cat << EOF
Handoff Validation Script

Usage:
  $(basename "$0") <feature-name>     Validate handoff chain for a feature
  $(basename "$0") --check-all        Show all document directory status
  $(basename "$0") --pre-commit       Pre-commit validation
  $(basename "$0") --before <agent>   Check requirements before specific agent
  $(basename "$0") --help             Show this help message

Agents:
  --before planner      Check if decision exists
  --before architect    Check if decision exists
  --before developer    Check if plan exists
  --before reviewer     Check if tests exist and pass
  --before git-manager  Check if review approved

Examples:
  $(basename "$0") auth
  $(basename "$0") --before developer auth
  $(basename "$0") --check-all
  $(basename "$0") --pre-commit

Exit Codes:
  0  All validations passed
  1  Validation failed
  2  Invalid usage
EOF
}

# ============================================================================
# Main
# ============================================================================

main() {
    # Check for docs directory
    if [ ! -d "$DOCS_DIR" ]; then
        echo -e "${CROSS} docs/ directory not found"
        echo -e "  Run: mkdir -p docs/{decisions,plans,research,architecture,test-reports,code-reviews,debug-reports,design-reports,database,security,performance,devops,api,metrics}"
        exit 1
    fi

    case "${1:-}" in
        --help|-h)
            show_usage
            exit 0
            ;;
        --check-all)
            check_all_directories
            exit 0
            ;;
        --pre-commit)
            pre_commit_check
            exit $?
            ;;
        --before)
            local agent="${2:-}"
            local feature="${3:-}"

            if [ -z "$agent" ] || [ -z "$feature" ]; then
                echo -e "${CROSS} Usage: $(basename "$0") --before <agent> <feature>"
                exit 2
            fi

            case "$agent" in
                planner)
                    validate_before_planner "$feature"
                    ;;
                architect)
                    validate_before_architect "$feature"
                    ;;
                developer|senior-developer)
                    validate_before_developer "$feature"
                    ;;
                reviewer|code-reviewer)
                    validate_before_reviewer "$feature"
                    ;;
                git-manager|git)
                    validate_before_git_manager "$feature"
                    ;;
                *)
                    echo -e "${CROSS} Unknown agent: $agent"
                    echo "Valid agents: planner, architect, developer, reviewer, git-manager"
                    exit 2
                    ;;
            esac
            exit $?
            ;;
        "")
            show_usage
            exit 2
            ;;
        *)
            local feature="$1"
            validate_full_workflow "$feature"

            if [ $? -eq 0 ]; then
                echo ""
                echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
                echo -e "${GREEN}  All handoff validations passed for: $feature${NC}"
                echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
                echo ""
                exit 0
            else
                echo ""
                echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
                echo -e "${RED}  Some validations failed for: $feature${NC}"
                echo -e "${RED}  Please address the issues above before proceeding${NC}"
                echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
                echo ""
                exit 1
            fi
            ;;
    esac
}

main "$@"
