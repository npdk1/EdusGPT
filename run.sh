#!/bin/sh
# EdusGPT - launcher cho macOS / Linux.
# Tren Windows dung run.bat.
set -e
cd "$(dirname "$0")"

echo ""
echo " ======================================================"
echo "   EdusGPT  |  GSAP + Three.js + Gemini"
echo " ======================================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo " [LOI] Khong tim thay Node.js. Cai ban tai https://nodejs.org"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo " [LOI] Node.js phai tu 22 tro len (ban dang co $(node -v))."
  exit 1
fi
echo " [OK] Node.js $(node -v)"

if [ ! -d node_modules ]; then
  echo " [..] Chua co node_modules - dang cai dat..."
  npm install
fi
echo " [OK] node_modules da co"

if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
  echo " [OK] Da tao .env.local tu .env.example"
fi

# giai phong cong 3000 neu bi chiem
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti tcp:3000 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    echo " [..] Cong 3000 dang bi chiem - dang dong lai..."
    kill $PIDS 2>/dev/null || true
    sleep 1
  fi
fi

command -v open >/dev/null 2>&1 && (open http://localhost:3000 &) || \
  command -v xdg-open >/dev/null 2>&1 && (xdg-open http://localhost:3000 &) || true

echo ""
echo "  Mo trinh duyet tai http://localhost:3000"
echo "  Cai Gemini key tai http://localhost:3000/setup"
echo "  Bam Ctrl+C de dung"
echo ""
echo " ------------------------------------------------------"
echo ""

npm run dev
