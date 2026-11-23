#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="${HOME}/.gemini/config/plugins/agy-ctx-ring"
MAC_APP="${HOME}/Applications/Antigravity (HUD).app"
LINUX_DESKTOP="${HOME}/.local/share/applications/antigravity-hud.desktop"

if [ -e "$PLUGIN_DIR" ]; then
  rm -rf "$PLUGIN_DIR"
  echo "==> Removed plugin directory: $PLUGIN_DIR"
else
  echo "==> Plugin directory not found: $PLUGIN_DIR"
fi

if [ -d "$MAC_APP" ]; then
  rm -rf "$MAC_APP"
  echo "==> Removed macOS launcher: $MAC_APP"
fi

if [ -f "$LINUX_DESKTOP" ]; then
  rm -f "$LINUX_DESKTOP"
  echo "==> Removed Linux desktop entry: $LINUX_DESKTOP"
fi

echo ""
echo "Uninstall complete. Antigravity.app and ~/.gemini/config/config.json were not modified."
