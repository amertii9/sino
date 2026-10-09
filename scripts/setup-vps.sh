#!/usr/bin/env bash
# ==============================================================================
# VPS Initial Setup Script for Truck Hauling & Fleet Management System
# Supports: Ubuntu 20.04+, Ubuntu 22.04+, Ubuntu 24.04+, Debian 11/12
# Run this once on your clean VPS:
#   curl -sSL https://raw.githubusercontent.com/<YOUR_USER>/<YOUR_REPO>/main/scripts/setup-vps.sh | sudo bash
# Or copy and run directly:
#   chmod +x scripts/setup-vps.sh && sudo ./scripts/setup-vps.sh
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "🚀 Starting VPS Provisioning for Truck Fleet System"
echo "=========================================================="

# Check root privileges
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Please run this script as root or with sudo."
  exit 1
fi

APP_DIR="/opt/truck-fleet"
echo "==> Target application directory: $APP_DIR"

# 1. Update system packages
echo "==> Updating package indexes..."
apt-get update -y
apt-get upgrade -y

# 2. Install essential utilities
echo "==> Installing prerequisite utilities..."
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    rsync \
    tar \
    htop

# 3. Install Docker Engine and Docker Compose Plugin
if ! command -v docker &> /dev/null; then
    echo "==> Installing Docker Engine..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installed successfully: $(docker --version)"
else
    echo "ℹ️ Docker is already installed: $(docker --version)"
fi

# Verify Docker Compose
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose plugin available: $(docker compose version)"
else
    echo "❌ Error: Docker compose plugin failed to install."
    exit 1
fi

# 4. Prepare application deployment directory
echo "==> Creating application directory at $APP_DIR..."
mkdir -p "$APP_DIR"
chmod 755 "$APP_DIR"

# If current user is not root (e.g. running under sudo ubuntu), add user to docker group
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    echo "==> Adding user '$SUDO_USER' to docker group and granting directory ownership..."
    usermod -aG docker "$SUDO_USER"
    chown -R "$SUDO_USER:$SUDO_USER" "$APP_DIR"
fi

# 5. Configure Basic Firewall (UFW)
echo "==> Configuring firewall rules..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 6060/tcp comment 'Frontend Web (Custom Port)'
ufw allow 6061/tcp comment 'Backend API (Custom Port)'
echo "y" | ufw enable || true

echo "=========================================================="
echo "🎉 VPS Setup Completed Successfully!"
echo "=========================================================="
echo "Next Steps:"
echo "1. Ensure your SSH Public Key (~/.ssh/authorized_keys) allows login from GitHub Actions."
echo "2. Add your GitHub Actions repository secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY, JWT_SECRET)."
echo "3. Push your code to the 'main' branch to trigger the CI/CD pipeline."
echo "=========================================================="
