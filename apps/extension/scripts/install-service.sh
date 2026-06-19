#!/bin/bash
set -e

PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$PLIST_DIR/com.today.mcp-server.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$PLIST_DIR"

sed \
  -e "s|{{BUN_PATH}}|$(which bun)|g" \
  -e "s|{{PROJECT_DIR}}|$(dirname "$SCRIPT_DIR")|g" \
  "$SCRIPT_DIR/com.today.mcp-server.plist.template" > "$PLIST_FILE"

launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"

echo "Service installed and started"
