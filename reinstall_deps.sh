#!/bin/bash
# Fix npm on WSL + NTFS by using WSL native filesystem for node_modules
# This avoids all NTFS permission/symlink/tar issues

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

FRONTEND_DIR='/mnt/d/01_Projects/NLP/AI CRM Brain/AI-CRM-Brain/frontend'
NATIVE_MODULES="$HOME/.node_modules_cache/ai-crm-brain-frontend"

echo "=== Setting up node_modules on WSL native filesystem ==="

# 1. Create the native directory
mkdir -p "$NATIVE_MODULES"

# 2. Remove any existing node_modules on NTFS
rm -rf "$FRONTEND_DIR/node_modules" 2>/dev/null

# 3. Create symlink: NTFS project -> WSL native ext4
ln -s "$NATIVE_MODULES" "$FRONTEND_DIR/node_modules"

if [ -L "$FRONTEND_DIR/node_modules" ]; then
    echo "✓ Symlink created successfully"
else
    echo "✗ Symlink creation failed"
    exit 1
fi

# 4. Run npm install (writes to ext4, fast and reliable)
cd "$FRONTEND_DIR"
echo "=== Running npm install (Node $(node --version)) ==="
npm install 2>&1

echo ""
echo "EXIT: $?"
