# Deployment Guide

This project is configured to deploy to an AWS EC2 instance using GitHub Actions.

## GitHub Secrets Setup

Before pushing to `main`, ensure the following secrets are added to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `EC2_HOST` | The public IP or DNS of your EC2 instance. |
| `NARU_GITHUB_PRIVATE_KEY` | The SSH private key (`.pem`) used to access the EC2. |
| `DATABASE_URL` | (Optional) The PostgreSQL connection string for production. |

## AWS RDS (PostgreSQL) Setup

If you are using AWS RDS, follow these steps to ensure connectivity:

1.  **Security Group**: In the AWS Console, edit the **Inbound Rules** for your RDS Security Group. Add a rule for Type: **PostgreSQL**, Port: **5432**, and Source: The **Security Group ID** of your EC2 instance.
2.  **Database URL**: Your `DATABASE_URL` in the `.env` file on the EC2 should look like this:
    ```env
    DATABASE_URL=postgresql://db_user:db_password@your-rds-endpoint.cluster-xyz.us-east-1.rds.amazonaws.com:5432/naru
    ```

## EC2 Server Setup

### 1. Install Node.js & pnpm
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm
```

### 2. Configure Directories
```bash
sudo mkdir -p /var/www/web/dist
sudo mkdir -p /var/www/backend
sudo chown -R ec2-user:ec2-user /var/www/web
sudo chown -R ec2-user:ec2-user /var/www/backend
```

### 3. Nginx Configuration
The configuration is now automatically deployed by GitHub Actions. For initial setup or manual updates, place `nginx/naru.conf` at `/etc/nginx/conf.d/naru.conf` on the EC2 instance:
```bash
# Manual setup (usually handled by GitHub Actions)
sudo cp nginx/naru.conf /etc/nginx/conf.d/naru.conf
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Backend Service (systemd)
Copy `deployment/naru-backend.service` to `/etc/systemd/system/naru-backend.service` and enable it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable naru-backend
sudo systemctl start naru-backend
```

### 5. Environment Variables
Create a `.env` file in `/var/www/backend` with your production secrets:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/naru
JWT_SECRET=your-production-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
PORT=3000
```

## How the Workflow Works

The `.github/workflows/deploy.yml` does the following:
1.  **Builds** the entire monorepo (shared, backend, web).
2.  **Packages** the backend using `pnpm deploy` (standalone bundle).
3.  **Uploads** static files to `/var/www/web/dist`.
4.  **Uploads** backend code to `/var/www/backend`.
5.  **Runs** `npx prisma migrate deploy` to update the production database.
6.  **Restarts** Nginx and the backend service.
