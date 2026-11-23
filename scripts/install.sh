#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/XMT-CN/agy-ctx-ring.git"
TARBALL_URL="https://github.com/XMT-CN/agy-ctx-ring/archive/refs/heads/main.tar.gz"
PLUGIN_DIR="${HOME}/.gemini/config/plugins/agy-ctx-ring"

copy_bundle() {
  local src="$1"
  local dst="$2"
  mkdir -p "$dst"
  rm -rf "$dst/assets" "$dst/sidecars"
  cp "$src/plugin.json" "$dst/plugin.json"
  cp -R "$src/assets" "$dst/assets"
  cp -R "$src/sidecars" "$dst/sidecars"
  [ -f "$src/README.md" ] && cp "$src/README.md" "$dst/README.md"
  [ -f "$src/README.zh-CN.md" ] && cp "$src/README.zh-CN.md" "$dst/README.zh-CN.md"
  [ -f "$src/LICENSE" ] && cp "$src/LICENSE" "$dst/LICENSE"
}

SCRIPT_SRC="${BASH_SOURCE[0]-}"
LOCAL_REPO=""
if [ -n "$SCRIPT_SRC" ] && [ -f "$SCRIPT_SRC" ]; then
  CANDIDATE_DIR="$(cd "$(dirname "$SCRIPT_SRC")/.." && pwd)"
  if [ -f "$CANDIDATE_DIR/plugin.json" ] && [ -d "$CANDIDATE_DIR/sidecars/ctx_ring" ]; then
    LOCAL_REPO="$CANDIDATE_DIR"
  fi
fi

mkdir -p "$(dirname "$PLUGIN_DIR")"

if [ -n "$LOCAL_REPO" ] && [ "$LOCAL_REPO" != "$PLUGIN_DIR" ]; then
  echo "==> Installing agy-ctx-ring from local checkout: $LOCAL_REPO"
  copy_bundle "$LOCAL_REPO" "$PLUGIN_DIR"
elif [ -d "$PLUGIN_DIR/.git" ] && command -v git >/dev/null 2>&1; then
  echo "==> Updating existing git installation: $PLUGIN_DIR"
  git -C "$PLUGIN_DIR" pull --ff-only
elif [ ! -e "$PLUGIN_DIR" ] && command -v git >/dev/null 2>&1; then
  echo "==> Cloning agy-ctx-ring into $PLUGIN_DIR"
  git clone --depth 1 "$REPO_URL" "$PLUGIN_DIR"
else
  echo "==> Downloading agy-ctx-ring archive..."
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  curl -fsSL "$TARBALL_URL" | tar -xz -C "$TMP_DIR" --strip-components=1
  copy_bundle "$TMP_DIR" "$PLUGIN_DIR"
fi

OS_NAME="$(uname -s)"
if [ "$OS_NAME" = "Darwin" ]; then
  APP_DIR="${HOME}/Applications"
  APP_PATH="${APP_DIR}/Antigravity (HUD).app"
  AGY_APP=""
  if [ -d "/Applications/Antigravity.app" ]; then
    AGY_APP="/Applications/Antigravity.app"
  elif [ -d "${HOME}/Applications/Antigravity.app" ]; then
    AGY_APP="${HOME}/Applications/Antigravity.app"
  fi

  if [ -n "$AGY_APP" ] && command -v osacompile >/dev/null 2>&1; then
    mkdir -p "$APP_DIR"
    rm -rf "$APP_PATH"
    osacompile -o "$APP_PATH" -e "do shell script \"open -a \\\"${AGY_APP}\\\" --args --remote-debugging-port=0\""
    if [ -f "${AGY_APP}/Contents/Resources/icon.icns" ] && [ -d "${APP_PATH}/Contents/Resources" ]; then
      cp "${AGY_APP}/Contents/Resources/icon.icns" "${APP_PATH}/Contents/Resources/applet.icns"
    fi
    touch "$APP_PATH"
    echo "==> Created macOS HUD launcher: $APP_PATH"
  else
    echo "==> Note: Antigravity.app not found in /Applications or ~/Applications; launch manually with:"
    echo "    open -a \"Antigravity\" --args --remote-debugging-port=0"
  fi
elif [ "$OS_NAME" = "Linux" ]; then
  AGY_BIN="$(command -v antigravity 2>/dev/null || true)"
  if [ -n "$AGY_BIN" ]; then
    DESKTOP_DIR="${HOME}/.local/share/applications"
    DESKTOP_FILE="${DESKTOP_DIR}/antigravity-hud.desktop"
    mkdir -p "$DESKTOP_DIR"
    cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Antigravity (HUD)
Comment=Launch Antigravity with runtime HUD support
Exec=${AGY_BIN} --remote-debugging-port=0 %U
Terminal=false
Categories=Development;IDE;
EOF
    echo "==> Created Linux desktop entry: $DESKTOP_FILE"
  else
    echo "==> Note: launch Antigravity manually with: antigravity --remote-debugging-port=0"
  fi
fi

echo ""
echo "Installation complete: $PLUGIN_DIR"
echo "Next steps:"
echo "  1. Completely quit Antigravity if it is currently running without --remote-debugging-port=0."
if [ "$OS_NAME" = "Darwin" ]; then
  echo "  2. Launch Antigravity via \"${HOME}/Applications/Antigravity (HUD).app\" (you can pin it to your Dock)."
elif [ "$OS_NAME" = "Linux" ]; then
  echo "  2. Launch Antigravity via \"Antigravity (HUD)\" or: antigravity --remote-debugging-port=0"
else
  echo "  2. Launch Antigravity with --remote-debugging-port=0."
fi
echo "  3. Confirm \"上下文胶囊 (agy-ctx-ring)\" is enabled under Customizations -> Plugins."
