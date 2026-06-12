#!/bin/bash
set -e

PLIST_FILE="$HOME/Library/LaunchAgents/com.today.mcp-server.plist"

if [ ! -f "$PLIST_FILE" ]; then
  echo "Service not installed. Run scripts/install-service.sh first." >&2
  exit 1
fi

launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"

echo "Service restarted (logs: /tmp/today-mcp-server.log)"
