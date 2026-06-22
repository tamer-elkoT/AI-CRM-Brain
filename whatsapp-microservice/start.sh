#!/bin/bash
# WhatsApp Microservice — smart start script
# Automatically kills any existing process on port 3000 before starting

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000

echo "🔍 Checking port $PORT..."
if fuser $PORT/tcp > /dev/null 2>&1; then
    echo "⚠️  Port $PORT is in use. Killing old process..."
    fuser -k $PORT/tcp
    sleep 1
    echo "✅ Port $PORT freed."
fi

echo "🚀 Starting WhatsApp Microservice..."
cd "$SCRIPT_DIR"
node server.js
