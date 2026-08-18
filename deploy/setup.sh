#!/bin/bash
##
## Tumbu — Server Setup Script
## Jalankan SATU KALI di server Ubuntu baru via SSH:
##   chmod +x deploy/setup.sh && sudo ./deploy/setup.sh
##
## Tested on: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
##

set -e  # Stop on any error
set -u  # Error on undefined variables

echo "════════════════════════════════════════"
echo "  TUMBU — Server Setup"
echo "════════════════════════════════════════"

# ── 1. Update System ──────────────────────────────────────────
echo ""
echo "▶ [1/6] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Install Docker & Docker Compose ───────────────────────
echo ""
echo "▶ [2/6] Installing Docker..."

# Hapus instalasi docker lama jika ada
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  apt-get remove -y "$pkg" 2>/dev/null || true
done

# Install Docker Engine resmi
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Aktifkan Docker service
systemctl enable docker
systemctl start docker

echo "   Docker versi: $(docker --version)"
echo "   Docker Compose versi: $(docker compose version)"

# ── 3. Install Nginx ──────────────────────────────────────────
echo ""
echo "▶ [3/6] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

echo "   Nginx versi: $(nginx -v 2>&1)"

# ── 4. Setup Nginx config ─────────────────────────────────────
echo ""
echo "▶ [4/6] Configuring Nginx..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# Copy Nginx config
cp "$REPO_DIR/deploy/nginx/tumbu.conf" /etc/nginx/sites-available/tumbu

# Aktifkan site
ln -sf /etc/nginx/sites-available/tumbu /etc/nginx/sites-enabled/tumbu

# Nonaktifkan default site
rm -f /etc/nginx/sites-enabled/default

# Test dan reload Nginx
nginx -t
systemctl reload nginx

echo "   Nginx configured ✓"

# ── 5. Setup Firewall ─────────────────────────────────────────
echo ""
echo "▶ [5/6] Configuring UFW firewall..."

apt-get install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (untuk masa depan)
ufw --force enable

echo "   Firewall configured ✓"
ufw status

# ── 6. Setup app directory ────────────────────────────────────
echo ""
echo "▶ [6/6] Setup complete!"
echo ""
echo "════════════════════════════════════════"
echo "  Setup selesai! Langkah selanjutnya:"
echo "════════════════════════════════════════"
echo ""
echo "1. Clone repo ke server:"
echo "   git clone <URL_REPO> /opt/tumbu"
echo "   cd /opt/tumbu"
echo ""
echo "2. Buat file .env dari template:"
echo "   cp .env.production.example .env"
echo "   nano .env  # ← isi semua nilai"
echo ""
echo "3. Jalankan aplikasi:"
echo "   cd /opt/tumbu && ./deploy/deploy.sh"
echo ""
