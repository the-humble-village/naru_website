#!/usr/bin/env bash
#
# Phase 0.7 — move the server from EOL Node 18 to Node 24, matching CI.
# Run this ON the EC2 instance (i-025ab3760f2dc2ae1):
#
#   aws ssm start-session --target i-025ab3760f2dc2ae1 --region us-east-1
#   sudo bash /tmp/phase0-upgrade-node.sh
#
# Restarts naru-backend and health-checks it. If the app does not come back,
# the script reverts to Node 18 and restarts again before exiting non-zero.
# One-time script — delete it once Phase 0 is done.

set -uo pipefail

OLD_NODE=/usr/bin/node-18
NEW_NODE=/usr/bin/node-24
HEALTH_TIMEOUT=60

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run with sudo." >&2
  exit 1
fi

# Poll both health paths (app.ts:73 and app.ts:88) plus the nginx front door.
# The currently deployed build predates some routes, so accept any of them.
wait_for_health() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while (( SECONDS < deadline )); do
    for url in http://127.0.0.1:3000/api/health http://127.0.0.1:3000/health http://127.0.0.1/api/health; do
      if curl -sf -m 3 "$url" > /dev/null 2>&1; then
        echo "  healthy: $url"
        return 0
      fi
    done
    sleep 2
  done
  return 1
}

switch_node() {
  local target=$1
  if alternatives --list 2>/dev/null | grep -q '^node[[:space:]]'; then
    alternatives --set node "$target"
  else
    ln -sfn "$target" /usr/bin/node
  fi
}

echo "=== BEFORE ==="
node --version
readlink -f /usr/bin/node
systemctl is-active naru-backend || true

echo
echo "=== BASELINE HEALTH (Node 18) ==="
if wait_for_health; then
  BASELINE_OK=1
else
  BASELINE_OK=0
  echo "  WARNING: app was already failing health checks before the upgrade."
  echo "  Continuing, but a post-upgrade failure will not be attributable to Node."
fi

echo
echo "=== INSTALLING nodejs24 ==="
dnf install -y nodejs24

if [[ ! -x "$NEW_NODE" ]]; then
  echo "ERROR: $NEW_NODE not found after install. Aborting, nothing changed." >&2
  exit 1
fi

echo
echo "=== SWITCHING /usr/bin/node ==="
switch_node "$NEW_NODE"
node --version
readlink -f /usr/bin/node

echo
echo "=== RESTARTING naru-backend ==="
systemctl restart naru-backend
sleep 3
systemctl is-active naru-backend || true

echo
echo "=== POST-UPGRADE HEALTH ==="
if wait_for_health; then
  echo
  echo "SUCCESS — running on $(node --version)."
  echo "Recent logs:"
  journalctl -u naru-backend -n 15 --no-pager
  exit 0
fi

echo
echo "FAILED health check after ${HEALTH_TIMEOUT}s. Rolling back to Node 18." >&2
journalctl -u naru-backend -n 40 --no-pager >&2
switch_node "$OLD_NODE"
systemctl restart naru-backend
sleep 3
if wait_for_health; then
  echo "Rolled back cleanly — running on $(node --version)." >&2
else
  echo "ROLLBACK ALSO UNHEALTHY. Investigate immediately." >&2
  if [[ $BASELINE_OK -eq 0 ]]; then
    echo "(Note: baseline was already unhealthy, so this may predate the upgrade.)" >&2
  fi
fi
exit 1
