#!/bin/bash
# ─────────────────────────────────────────────────────────────
# start_frontend.sh — Rabih CRM dev server launcher (WSL/Linux)
#
# Problem: node_modules are installed on Windows but Rollup needs
# a Linux-native binary (@rollup/rollup-linux-x64-gnu).
# Solution: run `npm install` from Linux so npm fetches the
# correct platform binary alongside the existing Windows one.
# ─────────────────────────────────────────────────────────────

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

FRONTEND_DIR='/mnt/d/01_Projects/NLP/AI CRM Brain/AI-CRM-Brain/frontend'
cd "$FRONTEND_DIR"

echo "Node: $(node --version)"
echo "npm:  $(npm --version)"

# Install / update platform-native binaries if needed
# (safe to run every time — npm skips packages already up to date)
echo "Ensuring platform-native binaries are installed..."
npm install --prefer-offline 2>&1 | tail -5

echo "Starting Vite dev server..."
npx vite --host 0.0.0.0 --port 5173
