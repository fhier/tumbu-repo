#!/bin/bash
##
## Tumbu — Deploy / Update Script
## Jalankan setiap kali ada update:
##   cd /opt/tumbu && ./deploy/deploy.sh
##

set -e
set -u

echo "════════════════════════════════════════"
echo "  TUMBU — Deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# ── 1. Cek .env ───────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo ""
  echo "❌ ERROR: File .env tidak ditemukan!"
  echo "   Buat dulu: cp .env.production.example .env && nano .env"
  exit 1
fi

echo ""
echo "▶ [1/5] Pulling latest code..."
git pull --rebase

# ── 2. Build images ───────────────────────────────────────────
echo ""
echo "▶ [2/5] Building Docker images..."
docker compose build --no-cache

# ── 3. Start/Restart services ─────────────────────────────────
echo ""
echo "▶ [3/5] Starting services..."
docker compose up -d

# ── 4. Run database migrations ────────────────────────────────
echo ""
echo "▶ [4/5] Running database migrations..."

# Tunggu API healthy sebelum migrate
echo "   Menunggu database siap..."
sleep 10

docker compose exec -T api sh -c "cd apps/api && npx prisma migrate deploy"

echo "   Migration selesai ✓"

# ── 5. Verify ─────────────────────────────────────────────────
echo ""
echo "▶ [5/5] Verifying deployment..."

sleep 5

# Check API health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "   API health check: ✓ ($HTTP_STATUS)"
else
  echo "   ⚠ API health check: $HTTP_STATUS (mungkin masih starting)"
fi

# Check Web
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$WEB_STATUS" = "200" ]; then
  echo "   Web health check: ✓ ($WEB_STATUS)"
else
  echo "   ⚠ Web health check: $WEB_STATUS (mungkin masih starting)"
fi

echo ""
echo "════════════════════════════════════════"
echo "  Deploy selesai!"
echo ""
echo "  Lihat logs: docker compose logs -f"
echo "  Status: docker compose ps"
echo "════════════════════════════════════════"
