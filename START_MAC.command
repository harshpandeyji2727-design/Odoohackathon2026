#!/bin/bash
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:$HOME/.local/node-v26.13.0-darwin-arm64/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.5+ is required. Install it from https://nodejs.org and run this launcher again."
  read -r -p "Press Enter to close..."
  exit 1
fi
NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])')
NODE_MINOR=$(node -p 'Number(process.versions.node.split(".")[1])')
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ]; }; then
  echo "Brightloop requires Node.js 22.5 or newer. Current version: $(node -v)"
  read -r -p "Press Enter to close..."
  exit 1
fi
if [ ! -f .env ]; then
  SECRET=$(openssl rand -hex 32)
  printf "PORT=4000\nJWT_SECRET=%s\nDATABASE_FILE=./data/brightloop.sqlite\nAPP_URL=http://localhost:4000\n" "$SECRET" > .env
fi
if [ ! -d node_modules/express ]; then
  echo "Installing Brightloop dependencies (first launch only)..."
  npm install || { read -r -p "Dependency installation failed. Press Enter to close..."; exit 1; }
fi
npm start &
SERVER_PID=$!
sleep 2
open http://localhost:4000
wait "$SERVER_PID"
