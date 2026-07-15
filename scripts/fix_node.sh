#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm alias default 20
nvm use 20
echo "Node: $(node --version)"
echo ""
echo "nvm is already in your ~/.bashrc. Close and reopen your WSL terminal"
echo "and Node 20 will be the default. Then just run: npm run dev"
