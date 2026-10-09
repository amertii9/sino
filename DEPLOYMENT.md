# 🚀 CI/CD & VPS Deployment Guide

This guide provides end-to-end instructions for deploying the **Truck Hauling & Fleet Management System** to a Linux VPS (Ubuntu 20.04/22.04/24.04 or Debian) using **GitHub Actions** and **Docker Compose**.

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Step 1: Local Git Repository Initialization](#step-1-local-git-repository-initialization)
3. [Step 2: VPS Preparation](#step-2-vps-preparation)
4. [Step 3: SSH Key Pair Setup for GitHub Actions](#step-3-ssh-key-pair-setup-for-github-actions)
5. [Step 4: Configuring GitHub Repository Secrets & Variables](#step-4-configuring-github-repository-secrets--variables)
6. [Step 5: Triggering Your First Deployment](#step-5-triggering-your-first-deployment)
7. [Step 6: Optional Domain & SSL Configuration](#step-6-optional-domain--ssl-configuration)
8. [Maintenance & Useful VPS Commands](#maintenance--useful-vps-commands)

---

## 1. Architecture Overview

When you push code to GitHub:
```mermaid
flowchart LR
    A[Local Code] -->|git push origin main| B[GitHub Repository]
    B -->|Trigger| C[GitHub Actions CI/CD]
    subgraph CI_Job ["Step 1: Validation"]
        D[Build Go Backend]
        E[Build React Frontend]
    end
    C --> CI_Job
    CI_Job -->|Success| F[Deploy via SSH / SCP]
    subgraph VPS ["Production VPS"]
        G[Sync files to /opt/truck-fleet]
        H[Inject Production .env]
        I[Docker Compose Build & Run]
        J[Nginx Frontend :6060]
        K[Go Gin Backend :6061]
        L[MongoDB Database :27017]
        I --> J
        I --> K
        I --> L
    end
    F --> VPS
```

- **Frontend Container (`fleet_frontend`)**: Nginx Alpine serving React build files, configured with SPA routing, gzip compression, and reverse proxying `/api` traffic to the backend.
- **Backend Container (`fleet_backend`)**: Multi-stage Go Gin application binary, with automatic MongoDB migration, healthcheck, and rate limiting.
- **Database Container (`fleet_mongodb`)**: MongoDB 7.0 with persistent data storage volume (`mongo_data`).

---

## Step 1: Local Git Repository Initialization

The repository has already been initialized with a clean `.gitignore` ignoring build binaries, `.env` files, and `node_modules`.

To push to your GitHub account:

1. Create a **New Repository** on [GitHub](https://github.com/new) (e.g. `truck-hauling-fleet`). Leave it empty (do **not** initialize with README or license).
2. Run the following commands in your local terminal:
```bash
# Add your GitHub remote URL (replace with your repo URL)
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

## Step 2: VPS Preparation

Connect to your VPS via SSH:
```bash
ssh root@<YOUR_VPS_IP>
```

### Option A: 1-Click Automated Setup (Recommended)
Run the automated provisioning script included in the repo:
```bash
curl -fsSL https://raw.githubusercontent.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>/main/scripts/setup-vps.sh | sudo bash
```
*(Or run `sudo bash scripts/setup-vps.sh` if files are already on the VPS).*

### Option B: Manual Setup
If you prefer manual configuration:
```bash
# 1. Update packages
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker & Compose plugin
sudo apt-get install -y ca-certificates curl gnupg ufw rsync
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# 4. Create deployment folder
sudo mkdir -p /opt/truck-fleet
sudo chmod 755 /opt/truck-fleet

# 5. Open firewall ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 6060/tcp
sudo ufw allow 6061/tcp
sudo ufw --force enable
```

---

## Step 3: SSH Key Pair Setup for GitHub Actions

GitHub Actions needs an SSH private key to securely connect and deploy to your VPS.

### 1. Generate a dedicated SSH key pair on your computer or VPS:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key
```
*(Press Enter when prompted for a passphrase to leave it empty).*

This generates two files:
- `~/.ssh/github_deploy_key` (Private key — keep safe!)
- `~/.ssh/github_deploy_key.pub` (Public key)

### 2. Add Public Key to your VPS:
On your VPS, append the public key to `~/.ssh/authorized_keys`:
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat ~/.ssh/github_deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. Verify Local SSH Connection:
```bash
ssh -i ~/.ssh/github_deploy_key root@<YOUR_VPS_IP>
```
If you can log in without being prompted for a password, your key setup is working!

---

## Step 4: Configuring GitHub Repository Secrets & Variables

In your GitHub repository:
1. Navigate to: **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret**.

### 🔒 Required Repository Secrets

| Secret Name | Description | Example Value |
|---|---|---|
| `VPS_HOST` | IP address or hostname of your VPS | `198.51.100.42` or `vps.yourdomain.com` |
| `VPS_USER` | SSH user on your VPS | `root` or `ubuntu` |
| `VPS_SSH_KEY` | Entire private key generated in Step 3 | Output of `cat ~/.ssh/github_deploy_key` (including `-----BEGIN ...` and `-----END ...`) |
| `JWT_SECRET` | 32+ character random secret for JWT authentication | Generate with `openssl rand -base64 32` |

### ⚙️ Optional Repository Secrets / Variables

| Secret Name | Default If Omitted | Description |
|---|---|---|
| `VPS_SSH_PORT` | `22` | SSH port if your VPS uses a non-standard port |
| `APP_DIR` | `/opt/truck-fleet` | Folder path on VPS where project files live |
| `MONGO_URI` | `mongodb://mongodb:27017` | MongoDB connection string (leave default for containerized Mongo, or enter MongoDB Atlas URI) |
| `MONGO_DB_NAME` | `truck_fleet_db` | Name of the MongoDB database |
| `CORS_ORIGINS` | `*` | Comma-separated list of allowed origins (e.g., `https://yourdomain.com`) |
| `FRONTEND_PORT` | `6060` | Port for web traffic (HTTP) |
| `BACKEND_PORT` | `6061` | Port for backend API server |

> [!IMPORTANT]
> When pasting `VPS_SSH_KEY`, make sure to copy the entire contents of the private key file, including the first line (`-----BEGIN OPENSSH PRIVATE KEY-----`) and the last line (`-----END OPENSSH PRIVATE KEY-----`), with no extra spaces.

---

## Step 5: Triggering Your First Deployment

Once secrets are configured:

1. **Automatic Deployment**:
   Make any commit and push to `main`:
   ```bash
   git add .
   git commit -m "Configure CI/CD deployment"
   git push origin main
   ```
2. **Manual Deployment**:
   - Go to your GitHub repository.
   - Click the **Actions** tab.
   - Select **CI/CD Pipeline - Test & Deploy to VPS** on the left menu.
   - Click **Run workflow** -> Select `main` -> Click the green **Run workflow** button.

### What the Pipeline Does Automatically:
1. **Validate**: Runs Go vet and build test, runs npm build test.
2. **Sync**: Securely copies application code to `/opt/truck-fleet` on your VPS.
3. **Environment**: Generates the production `.env` file using your GitHub secrets.
4. **Deploy**: Builds Docker images and starts containers with Docker Compose.
5. **Healthcheck**: Verifies `http://127.0.0.1:6061/api/health` responds with `status: ok`.
6. **Cleanup**: Removes dangling images to conserve server storage.

---

## Step 6: Optional Domain & SSL Configuration

To access your application via HTTPS domain (e.g. `https://fleet.yourdomain.com`):

### 1. Point DNS
Create an **A Record** in your domain DNS registrar pointing to your VPS IP:
- Host: `fleet` (or `@`)
- Value: `<YOUR_VPS_IP>`

### 2. Install Certbot on VPS
If you run Nginx on the host or use Certbot:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

Alternatively, you can place Nginx Proxy Manager or Traefik in front of the Docker containers, or run Certbot standalone:
```bash
# Temporarily stop container on port 80
docker compose -f /opt/truck-fleet/docker-compose.yml stop frontend

# Obtain certificate
sudo certbot certonly --standalone -d fleet.yourdomain.com

# Start frontend again
docker compose -f /opt/truck-fleet/docker-compose.yml start frontend
```

---

## Maintenance & Useful VPS Commands

Run these commands via SSH on your VPS inside `/opt/truck-fleet`:

```bash
cd /opt/truck-fleet

# Check running containers and health status
docker compose ps

# View live application logs
docker compose logs -f

# View backend logs specifically
docker compose logs -f backend

# View frontend logs
docker compose logs -f frontend

# Restart all services
docker compose restart

# Stop all services
docker compose down

# Start all services
docker compose up -d

# Inspect MongoDB data
docker compose exec mongodb mongosh truck_fleet_db --eval "db.trips.countDocuments()"

# Backup MongoDB database
docker compose exec mongodb mongodump --db truck_fleet_db --out /data/db/backup
```
