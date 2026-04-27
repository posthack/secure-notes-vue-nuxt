#!/usr/bin/env bash
# разворачивает secure-notes на чистом debian/ubuntu vps под ключ:
# node, caddy с авто-https, systemd. домен берётся из ip сервера через sslip.io.
# запуск от root:  curl -fsSL https://raw.githubusercontent.com/posthack/secure-notes-vue-nuxt/main/deploy.sh | bash
set -euo pipefail

APP_DIR="/opt/secure-notes"
REPO="https://github.com/posthack/secure-notes-vue-nuxt.git"

IP=$(curl -fsS https://api.ipify.org)
DOMAIN="$IP.sslip.io"
echo ">> разворачиваю на $DOMAIN"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg openssl debian-keyring debian-archive-keyring apt-transport-https

# если активен ufw — пустить веб
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp; ufw allow 443/tcp
fi

# node 22 (лок собран npm 11)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm i -g npm@11

# caddy — реверс-прокси с автоматическим tls
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

# приложение
rm -rf "$APP_DIR"
git clone "$REPO" "$APP_DIR"
cd "$APP_DIR"
npm ci
mkdir -p .data
cat > .env <<EOF
DATABASE_URL=file:./.data/sqlite.db
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://$DOMAIN
EOF
npm run db:migrate
npm run build

# systemd-юнит
cat > /etc/systemd/system/secure-notes.service <<EOF
[Unit]
Description=Secure Notes
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/node $APP_DIR/.output/server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now secure-notes

# caddy на домен
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    reverse_proxy 127.0.0.1:3000
}
EOF
systemctl restart caddy

sleep 3
systemctl --no-pager --lines=4 status secure-notes || true
echo "=========================================="
echo "  готово: https://$DOMAIN"
echo "  первый заход ~30с — caddy получает сертификат"
echo "=========================================="
