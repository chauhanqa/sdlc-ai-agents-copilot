#!/usr/bin/env bash

set -euo pipefail

echo "Configuring repository Git hooks..."

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$REPO_ROOT" ]; then
    echo "ERROR: This script must be executed inside a Git repository."
    exit 1
fi

cd "$REPO_ROOT"

HOOKS_DIR=".githooks"

if [ ! -d "$HOOKS_DIR" ]; then
    echo "ERROR: $HOOKS_DIR does not exist."
    exit 1
fi

git config core.hooksPath "$HOOKS_DIR"

# Make existing hook scripts executable.
for hook in pre-commit pre-push commit-msg; do
    if [ -f "$HOOKS_DIR/$hook" ]; then
        chmod +x "$HOOKS_DIR/$hook"
    fi
done

CONFIGURED_PATH="$(git config --get core.hooksPath || true)"

if [ "$CONFIGURED_PATH" != "$HOOKS_DIR" ]; then
    echo "ERROR: Failed to configure Git hooks path."
    exit 1
fi

echo ""
echo "Git hooks configured successfully."
echo "Repository: $REPO_ROOT"
echo "Hooks path: $CONFIGURED_PATH"
echo ""
echo "Active hooks:"

FOUND_HOOK=false

for hook in pre-commit pre-push commit-msg; do
    if [ -x "$HOOKS_DIR/$hook" ]; then
        echo "  - $hook"
        FOUND_HOOK=true
    fi
done

if [ "$FOUND_HOOK" = false ]; then
    echo "  None yet. Hook files can now be added under .githooks/."
fi