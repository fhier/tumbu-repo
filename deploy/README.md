# Tumbu — Panduan Deployment ke Ubuntu Server via SSH

## Prasyarat

- Server Ubuntu 22.04 LTS atau 24.04 LTS
- Akses SSH ke server (username + password atau SSH key)
- Repo Tumbu sudah ada di GitHub/GitLab (private atau public)

---

## Arsitektur yang Dibangun

```
[Ubuntu Server]
│
├── Nginx (port 80)           ← entry point dari luar
│   ├── /          → Docker: tumbu_web  (Next.js  :3000)
│   └── /api/*     → Docker: tumbu_api  (NestJS   :3001)
│
├── Docker Compose
│   ├── tumbu_web             (Next.js  — port 3000 internal)
│   ├── tumbu_api             (NestJS   — port 3001 internal)
│   └── tumbu_postgres        (PostgreSQL 16 — port 5432 internal)
│
└── Volume: postgres_data     ← data persisten
```

---

## Langkah 1 — SSH ke Server

```bash
ssh username@IP_SERVER_ANDA
```

---

## Langkah 2 — Clone Repo

```bash
# Clone ke /opt/tumbu (atau direktori pilihan Anda)
sudo mkdir -p /opt/tumbu
sudo chown $USER:$USER /opt/tumbu
git clone https://github.com/AKUN_ANDA/tumbu-repo-gas.git /opt/tumbu
cd /opt/tumbu
```

---

## Langkah 3 — Jalankan Setup Server (1x)

```bash
chmod +x deploy/setup.sh
sudo ./deploy/setup.sh
```

Script ini akan menginstall:
- Docker Engine (terbaru)
- Docker Compose Plugin
- Nginx
- UFW Firewall (allow port 80, 443, 22)

---

## Langkah 4 — Buat File .env

```bash
cp .env.production.example .env
nano .env
```

**Isi minimal yang WAJIB diganti:**

| Variable | Contoh nilai |
|---|---|
| `POSTGRES_PASSWORD` | `S3cur3P4ssw0rd2025!` |
| `DATABASE_URL` | `postgresql://tumbu:S3cur3P4ssw0rd2025!@postgres:5432/tumbu` |
| `ADMIN_PASSWORD` | `AdminKuat2025!` |
| `DEMO_USER_PASSWORD` | `DemoTumbu2025!` |
| `CORS_ORIGIN` | `http://192.168.1.100` (IP server Anda) |
| `NEXT_PUBLIC_API_URL` | `http://192.168.1.100` |
| `STUB_WEBHOOK_SECRET` | `WebhookSecretKuat2025!` |

> **Catatan:** Jika `TUMBU_ENV=production` dan `REQUIRE_STRICT_SECRETS=1`, API akan **gagal start** jika ada nilai default/placeholder. Ini adalah fitur keamanan yang disengaja.

---

## Langkah 5 — Deploy Pertama Kali

```bash
cd /opt/tumbu
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Script ini akan:
1. `git pull` kode terbaru
2. Build Docker images (API + Web)
3. Start semua containers
4. Jalankan `prisma migrate deploy` (buat tabel database)
5. Health check API dan Web

---

## Langkah 6 — Verifikasi

```bash
# Cek status containers
docker compose ps

# Cek logs real-time
docker compose logs -f

# Test API
curl http://localhost:3001/api/health

# Test Web
curl -I http://localhost:3000

# Test via Nginx (dari luar)
curl http://IP_SERVER_ANDA/api/health
curl http://IP_SERVER_ANDA
```

---

## Deploy Update (Setelah Perubahan Code)

```bash
cd /opt/tumbu
./deploy/deploy.sh
```

---

## Perintah Berguna

```bash
# Lihat semua containers
docker compose ps

# Lihat logs API
docker compose logs api -f

# Lihat logs Web
docker compose logs web -f

# Lihat logs Database
docker compose logs postgres -f

# Masuk ke container API (debug)
docker compose exec api sh

# Jalankan prisma studio (lihat database via browser)
docker compose exec api npx prisma studio --port 5555

# Backup database
docker compose exec postgres pg_dump -U tumbu tumbu > backup_$(date +%Y%m%d).sql

# Restart satu service
docker compose restart api

# Stop semua
docker compose down

# Stop dan hapus volumes (HATI-HATI: data hilang!)
docker compose down -v
```

---

## Troubleshooting

### API tidak start — error secrets
```
Error: R4-1 secrets: ADMIN_PASSWORD wajib di-set dan bukan password pengembangan.
```
**Solusi:** Edit `.env`, ganti `ADMIN_PASSWORD` dengan nilai kuat (min 12 karakter).

### Database connection error
```
Error: Can't reach database server at postgres:5432
```
**Solusi:** Pastikan container `postgres` sudah healthy:
```bash
docker compose ps postgres
docker compose logs postgres
```

### Nginx 502 Bad Gateway
**Solusi:** Pastikan containers sudah running:
```bash
docker compose up -d
docker compose ps
```

### Port 80 sudah terpakai
```bash
sudo lsof -i :80
# Hentikan service yang pakai port 80
sudo systemctl stop apache2  # jika apache
```
