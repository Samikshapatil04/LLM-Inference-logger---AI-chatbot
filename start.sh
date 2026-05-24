#!/bin/bash
# ──────────────────────────────────────────────────────────────
#  LLM Inference Logger — Local Development Quick Start
# ──────────────────────────────────────────────────────────────
set -e
RESET="\033[0m"; BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"

echo -e "\n${BOLD}${CYAN}🚀 LLM Inference Logger${RESET}\n"

# Load .env if present
[ -f .env ] && export $(grep -v '^#' .env | xargs) && echo -e "${GREEN}✅ Loaded .env${RESET}"

# Warn if no API key
if [ -z "$GEMINI_API_KEY" ]; then
  echo -e "${YELLOW}⚠️  GEMINI_API_KEY not set!${RESET}"
  echo "   Get a free key → https://aistudio.google.com/app/apikey"
  echo "   Then: export GEMINI_API_KEY=your_key   or add it to .env"
  echo "   (You can also enter it in the app Settings modal)\n"
fi

# Install deps
echo "📦 Installing backend deps…"
(cd backend && npm install --silent)
echo "📦 Installing frontend deps…"
(cd frontend && npm install --silent)
echo -e "${GREEN}✅ Dependencies ready${RESET}\n"

# Start backend
echo "🔧 Starting backend on :3001…"
GEMINI_API_KEY=${GEMINI_API_KEY:-} node backend/src/index.js &
BACKEND_PID=$!

sleep 2

# Start frontend dev server
echo "🌐 Starting frontend on :3000…"
cd frontend && npm run dev -- --host &
FRONTEND_PID=$!

echo -e "\n${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  App:        ${CYAN}http://localhost:3000${RESET}"
echo -e "${BOLD}  API:        ${CYAN}http://localhost:3001/api${RESET}"
echo -e "${BOLD}  Analytics:  ${CYAN}http://localhost:3001/api/logs/analytics${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "Press ${BOLD}Ctrl+C${RESET} to stop\n"

cleanup() { kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo -e "\n👋 Stopped"; exit; }
trap cleanup INT TERM
wait
