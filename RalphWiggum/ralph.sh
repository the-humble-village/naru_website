#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# ralph.sh — Ralph Wiggum Migration Loop
#
# Repeatedly invokes Claude Code to implement migration features one at a time.
# State is managed via features.json (status tracking) and progress.log.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Configuration ────────────────────────────────────────────────────────────
MAX_ITERATIONS=80
MAX_RETRIES=3
COOLDOWN_SECONDS=2
CLAUDE_MODEL="claude-sonnet-4-20250514"
CLAUDE_MAX_TURNS=50
FEATURES_FILE="features.json"
PROGRESS_LOG="progress.log"
SYSTEM_PROMPT_FILE="RALPH_PROMPT.md"

# ── Prerequisites ────────────────────────────────────────────────────────────
check_prerequisites() {
  local missing=0

  if ! command -v node &>/dev/null; then
    echo "ERROR: node is not installed" >&2
    missing=1
  fi

  if ! command -v pnpm &>/dev/null; then
    echo "ERROR: pnpm is not installed" >&2
    missing=1
  fi

  if ! command -v claude &>/dev/null; then
    echo "ERROR: claude CLI is not installed" >&2
    missing=1
  fi

  if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is not installed" >&2
    missing=1
  fi

  if [[ ! -f "$FEATURES_FILE" ]]; then
    echo "ERROR: $FEATURES_FILE not found" >&2
    missing=1
  fi

  if [[ ! -f "$SYSTEM_PROMPT_FILE" ]]; then
    echo "ERROR: $SYSTEM_PROMPT_FILE not found" >&2
    missing=1
  fi

  if [[ $missing -ne 0 ]]; then
    echo "Fix the above errors and re-run." >&2
    exit 1
  fi
}

# ── Logging ──────────────────────────────────────────────────────────────────
log() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$timestamp] $*" | tee -a "$PROGRESS_LOG"
}

# ── Feature selection ────────────────────────────────────────────────────────
# Returns the next feature to work on:
#   1. A failed feature with retries remaining
#   2. The next pending feature whose dependencies are all "passed"
#   3. Empty string if nothing left to do
pick_next_feature() {
  local features
  features="$(cat "$FEATURES_FILE")"

  # First: find a failed feature with retries left
  local failed_id
  failed_id="$(echo "$features" | jq -r --argjson max "$MAX_RETRIES" '
    [ .[] | select(.status == "failed" and .retries < $max) ] |
    first // empty |
    .id // empty
  ')"
  if [[ -n "$failed_id" ]]; then
    echo "$failed_id"
    return
  fi

  # Second: find next pending feature with all deps passed
  local pending_id
  pending_id="$(echo "$features" | jq -r '
    . as $all |
    [ $all[] | select(.status == "passed") | .id ] as $passed |
    [ $all[] | select(.status == "pending") |
      select( .dependencies | all(. as $dep | $passed | any(. == $dep)) )
    ] |
    first // empty |
    .id // empty
  ')"
  echo "$pending_id"
}

# ── Feature data helpers ─────────────────────────────────────────────────────
get_feature_json() {
  local feature_id="$1"
  jq ".[] | select(.id == \"$feature_id\")" "$FEATURES_FILE"
}

get_feature_field() {
  local feature_id="$1"
  local field="$2"
  jq -r ".[] | select(.id == \"$feature_id\") | .$field" "$FEATURES_FILE"
}

update_feature_status() {
  local feature_id="$1"
  local new_status="$2"
  local tmp
  tmp="$(mktemp)"
  jq "map(if .id == \"$feature_id\" then .status = \"$new_status\" else . end)" \
    "$FEATURES_FILE" > "$tmp" && mv "$tmp" "$FEATURES_FILE"
}

increment_retries() {
  local feature_id="$1"
  local tmp
  tmp="$(mktemp)"
  jq "map(if .id == \"$feature_id\" then .retries = (.retries + 1) else . end)" \
    "$FEATURES_FILE" > "$tmp" && mv "$tmp" "$FEATURES_FILE"
}

set_last_error() {
  local feature_id="$1"
  local error_msg="$2"
  local tmp
  tmp="$(mktemp)"
  # Truncate error to 2000 chars to keep features.json manageable
  local truncated
  truncated="$(echo "$error_msg" | head -c 2000)"
  jq --arg id "$feature_id" --arg err "$truncated" \
    'map(if .id == $id then .lastError = $err else . end)' \
    "$FEATURES_FILE" > "$tmp" && mv "$tmp" "$FEATURES_FILE"
}

# ── Build the dynamic prompt for Claude ──────────────────────────────────────
build_iteration_prompt() {
  local feature_id="$1"
  local iteration="$2"
  local feature_json
  feature_json="$(get_feature_json "$feature_id")"
  local feature_name
  feature_name="$(echo "$feature_json" | jq -r '.name')"
  local feature_desc
  feature_desc="$(echo "$feature_json" | jq -r '.description')"
  local verify_cmd
  verify_cmd="$(echo "$feature_json" | jq -r '.verify')"
  local last_error
  last_error="$(echo "$feature_json" | jq -r '.lastError // empty')"
  local retries
  retries="$(echo "$feature_json" | jq -r '.retries')"

  local prompt="## Ralph Wiggum Migration — Iteration $iteration

### Feature to implement:
- **ID**: $feature_id
- **Name**: $feature_name
- **Description**: $feature_desc
- **Verify command**: \`$verify_cmd\`
- **Iteration number**: $iteration"

  if [[ -n "$last_error" && "$last_error" != "null" ]]; then
    prompt="$prompt

### RETRY CONTEXT (attempt $((retries + 1)) of $MAX_RETRIES):
This feature FAILED on a previous attempt. Here is the error from the last run:
\`\`\`
$last_error
\`\`\`
Focus on fixing this specific error. Read the files that were already created/modified in prior attempts — do NOT start from scratch."
  fi

  prompt="$prompt

### Instructions:
1. Read ARCH_MIGRATION.md for the target architecture spec.
2. Read features.json to see what's already done.
3. Read any existing files in the relevant package before creating new ones.
4. Implement the feature described above.
5. Run the verify command: \`$verify_cmd\`
6. If it passes, commit with: feat($feature_id): $feature_name — Ralph iteration $iteration
7. If it fails, debug and fix. Do NOT commit on failure."

  echo "$prompt"
}

# ── Run verification command ─────────────────────────────────────────────────
run_verify() {
  local feature_id="$1"
  local verify_cmd
  verify_cmd="$(get_feature_field "$feature_id" "verify")"

  log "  Running verify: $verify_cmd"

  local output
  local exit_code=0
  output="$(bash -c "$verify_cmd" 2>&1)" || exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    log "  ✓ Verify PASSED"
    return 0
  else
    log "  ✗ Verify FAILED (exit code $exit_code)"
    log "  Error output: $(echo "$output" | tail -20)"
    set_last_error "$feature_id" "$output"
    return 1
  fi
}

# ── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
  local passed failed pending skipped
  passed="$(jq '[.[] | select(.status == "passed")] | length' "$FEATURES_FILE")"
  failed="$(jq '[.[] | select(.status == "failed")] | length' "$FEATURES_FILE")"
  pending="$(jq '[.[] | select(.status == "pending")] | length' "$FEATURES_FILE")"
  skipped="$(jq --argjson max "$MAX_RETRIES" '[.[] | select(.status == "failed" and .retries >= $max)] | length' "$FEATURES_FILE")"
  local total
  total="$(jq 'length' "$FEATURES_FILE")"

  log ""
  log "═══════════════════════════════════════════"
  log "  RALPH WIGGUM MIGRATION — FINAL SUMMARY"
  log "═══════════════════════════════════════════"
  log "  Total features:   $total"
  log "  Passed:           $passed"
  log "  Failed:           $failed (permanently: $skipped)"
  log "  Pending:          $pending"
  log "═══════════════════════════════════════════"

  if [[ "$passed" -eq "$total" ]]; then
    log "  🎉 ALL FEATURES PASSED!"
    log ""
    log "  Running final integration check..."
    if pnpm build 2>&1 && pnpm test -- --run 2>&1; then
      log "  ✓ Final integration check PASSED"
    else
      log "  ✗ Final integration check FAILED — review manually"
    fi
  fi
}

# ── Main loop ────────────────────────────────────────────────────────────────
main() {
  check_prerequisites

  # Reset any features stuck in "in_progress" from a prior interrupted run
  local stuck
  stuck="$(jq '[.[] | select(.status == "in_progress")] | length' "$FEATURES_FILE")"
  if [[ "$stuck" -gt 0 ]]; then
    log "Resetting $stuck feature(s) stuck in 'in_progress' from a prior run"
    local tmp
    tmp="$(mktemp)"
    jq 'map(if .status == "in_progress" then (if .retries > 0 then .status = "failed" else .status = "pending" end) else . end)' \
      "$FEATURES_FILE" > "$tmp" && mv "$tmp" "$FEATURES_FILE"
  fi

  log ""
  log "═══════════════════════════════════════════"
  log "  RALPH WIGGUM MIGRATION LOOP — STARTING"
  log "═══════════════════════════════════════════"
  log "  Max iterations: $MAX_ITERATIONS"
  log "  Max retries per feature: $MAX_RETRIES"
  log "  Model: $CLAUDE_MODEL"
  log ""

  local iteration=0

  while [[ $iteration -lt $MAX_ITERATIONS ]]; do
    iteration=$((iteration + 1))

    # Pick next feature
    local feature_id
    feature_id="$(pick_next_feature)"

    if [[ -z "$feature_id" ]]; then
      # Check if everything passed or if we're stuck
      local pending
      pending="$(jq '[.[] | select(.status == "pending")] | length' "$FEATURES_FILE")"
      if [[ "$pending" -eq 0 ]]; then
        log "All features processed. Exiting loop."
      else
        log "No actionable features remain (pending: $pending, but deps unmet or retries exhausted). Exiting."
      fi
      break
    fi

    local feature_name
    feature_name="$(get_feature_field "$feature_id" "name")"
    local current_status
    current_status="$(get_feature_field "$feature_id" "status")"

    log "─── Iteration $iteration ─── Feature: $feature_id ($feature_name) ───"

    if [[ "$current_status" == "failed" ]]; then
      local retries
      retries="$(get_feature_field "$feature_id" "retries")"
      log "  Retrying (attempt $((retries + 1)) of $MAX_RETRIES)"
    fi

    # Build dynamic prompt
    local iteration_prompt
    iteration_prompt="$(build_iteration_prompt "$feature_id" "$iteration")"

    # Mark as in-progress
    update_feature_status "$feature_id" "in_progress"

    # Invoke Claude Code
    log "  Invoking Claude Code..."
    local claude_output
    local claude_exit=0
    claude_output="$(claude -p "$iteration_prompt" \
      --model "$CLAUDE_MODEL" \
      --system-prompt "$(cat "$SYSTEM_PROMPT_FILE")" \
      --allowedTools 'Bash(ls *)' 'Bash(cat *)' 'Bash(test *)' 'Bash(node *)' 'Bash(npx prisma *)' 'Bash(pnpm build*)' 'Bash(pnpm test *)' 'Bash(git add *)' 'Bash(git commit *)' 'Bash(git status*)' 'Bash(git diff*)' 'Bash(git log*)' 'Bash(tsc*)' 'Bash(cd *)' 'Bash(mkdir *)' 'Bash(cp *)' 'Bash(mv *)' 'Bash(echo *)' 'Bash(pwd)' 'Bash(which *)' 'Bash(head *)' 'Bash(tail *)' 'Bash(wc *)' 'Bash(sort *)' 'Bash(find *)' 'Bash(grep *)' 'Bash(sed *)' 'Bash(touch *)' 'Read' 'Write' 'Edit' 'Glob' 'Grep' \
      --max-turns "$CLAUDE_MAX_TURNS" \
      --output-format text \
      2>&1)" || claude_exit=$?

    if [[ $claude_exit -ne 0 ]]; then
      log "  Claude Code exited with code $claude_exit"
      log "  Output tail: $(echo "$claude_output" | tail -10)"
    fi

    # Run verify command
    if run_verify "$feature_id"; then
      update_feature_status "$feature_id" "passed"
      log "  ✓ Feature $feature_id PASSED"
    else
      update_feature_status "$feature_id" "failed"
      increment_retries "$feature_id"
      local new_retries
      new_retries="$(get_feature_field "$feature_id" "retries")"
      if [[ "$new_retries" -ge "$MAX_RETRIES" ]]; then
        log "  ✗ Feature $feature_id PERMANENTLY FAILED after $MAX_RETRIES retries"
      else
        log "  ✗ Feature $feature_id failed (retry $new_retries/$MAX_RETRIES)"
      fi
    fi

    # Cooldown
    log "  Cooling down ${COOLDOWN_SECONDS}s..."
    sleep "$COOLDOWN_SECONDS"
  done

  if [[ $iteration -ge $MAX_ITERATIONS ]]; then
    log "Reached max iterations ($MAX_ITERATIONS). Stopping."
  fi

  print_summary
}

main "$@"
