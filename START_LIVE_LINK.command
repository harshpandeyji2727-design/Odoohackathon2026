#!/bin/bash
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:$HOME/.local/node-v26.13.0-darwin-arm64/bin:$PATH"

echo "==========================================="
echo "   Brightloop Live Link Launcher"
echo "==========================================="

# Kill any existing server on 4000
lsof -ti :4000 | xargs kill -9 2>/dev/null

# Start backend server
node src/server.js > /tmp/brightloop_server.log 2>&1 &
SERVER_PID=$!
sleep 2

# Start cloudflared tunnel
echo "Starting secure public live tunnel..."
cloudflared tunnel --url http://localhost:4000 2>&1 | tee /tmp/brightloop_tunnel.log &
TUNNEL_PID=$!

# Wait for tunnel URL
LIVE_URL=""
for i in {1..30}; do
  LIVE_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/brightloop_tunnel.log | head -n 1)
  if [ -n "$LIVE_URL" ]; then
    break
  fi
  sleep 1
done

if [ -n "$LIVE_URL" ]; then
  echo ""
  echo ">>> LIVE LINK READY: $LIVE_URL <<<"
  echo "Local URL: http://localhost:4000"
  echo "Opening live link in your default browser..."
  open "$LIVE_URL"
else
  echo "Tunnel took longer than expected. Check /tmp/brightloop_tunnel.log"
fi

echo ""
echo "Demo Accounts (Password for all: Brightloop!2026):"
echo "- Admin: admin@brightloop.demo"
echo "- Staff: staff@brightloop.demo"
echo "- Customer: customer@brightloop.demo"
echo ""
echo "Press Ctrl+C to stop the live link and server."

trap "kill $SERVER_PID $TUNNEL_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
