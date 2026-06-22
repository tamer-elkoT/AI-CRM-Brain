#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
cd '/mnt/d/01_Projects/NLP/AI CRM Brain/AI-CRM-Brain/frontend'
echo "Node: $(node --version)"
npx vite
