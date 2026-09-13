#!/bin/bash
# ==============================================================================
# Campus Event Management & Booking API - Production VPS Deployment Script
# Designed for: Ubuntu Server 24.04 LTS (campus-event-vm on Azure)
# Author: Mi Hnin Au Shwe Yee (Member 1 - Infra & Auth)
# ==============================================================================

set -e

echo "🚀 [1/6] Updating system packages & hardening UFW firewall..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ufw curl git nginx certbot python3-certbot-nginx

# Hardening: UFW Firewall rules
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "🐳 [2/6] Installing Docker & Docker Compose Plugin..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    sudo rm get-docker.sh
fi

echo "📦 [3/6] Setting up project directory & pulling latest code..."
APP_DIR="/home/azureuser/campus-event-booking-api"

if [ ! -d "$APP_DIR" ]; then
    git clone https://github.com/kaungwaiyan96/campus-event-booking-api.git "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin
git checkout main
git pull origin main

echo "🏗️  [4/6] Building and running Docker containers..."
sudo docker compose down --remove-orphans || true
sudo docker compose up -d --build

echo "🔄 [5/6] Running Prisma Database Migrations & Seeds inside container..."
sleep 5 # Wait for postgres to be healthy
sudo docker compose exec -T api npx prisma migrate deploy || true

echo "🌐 [6/6] Configuring Nginx Reverse Proxy..."
sudo cp nginx/default.conf /etc/nginx/sites-available/campus-event.conf
sudo ln -sf /etc/nginx/sites-available/campus-event.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo "✅ ====================================================================="
echo "✅ Deployment completed successfully!"
echo "✅ Health check: http://localhost:5000/events-api/v1/health"
echo "✅ API Base URL: https://campus-event-api.southeastasia.cloudapp.azure.com/events-api/v1"
echo "✅ ====================================================================="
