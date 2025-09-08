# Deployment Guide for moments.thinkable.app/support

## Prerequisites on Server

1. **Connect to your server:**
```bash
ssh -i /Users/gurilany/samuramu.pem ubuntu@63.178.138.63
```

2. **Install required software (if not already installed):**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx (if not installed)
sudo apt install nginx -y
```

## Deployment Steps

### 1. Initial Setup (First Time Only)

**On your local machine:**

```bash
# 1. Copy your Firebase service account key to the project
cp ~/path/to/your/serviceAccountKey.json ./serviceAccountKey.json

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your settings (SMTP, email, etc.)

# 3. Run the deployment script
./deploy.sh
```

### 2. Server Configuration (First Time Only)

**On the server:**

```bash
# 1. SSH into server
ssh -i /Users/gurilany/samuramu.pem ubuntu@63.178.138.63

# 2. Navigate to project directory
cd /var/www/moments.thinkable.app/support-agent

# 3. Upload Firebase service account key via SFTP
# From your local machine:
sftp -i /Users/gurilany/samuramu.pem ubuntu@63.178.138.63
cd /var/www/moments.thinkable.app/support-agent
put serviceAccountKey.json
exit

# 4. Configure environment variables on server
nano .env
# Add your configuration:
# FIREBASE_SERVICE_ACCOUNT_KEY=./serviceAccountKey.json
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# EMAIL_TO=your-recipient@example.com
# PORT=3000
# ANALYSIS_SCHEDULE=0 9 * * *

# 5. Set proper permissions
chmod 600 serviceAccountKey.json
chmod 600 .env
```

### 3. Configure Nginx

**On the server:**

```bash
# 1. Edit Nginx configuration
sudo nano /etc/nginx/sites-available/moments.thinkable.app

# 2. Add the location block for /support/ (see nginx.conf file)
# Or create new site configuration if doesn't exist

# 3. Test Nginx configuration
sudo nginx -t

# 4. Reload Nginx
sudo systemctl reload nginx
```

### 4. Start the Service

```bash
# 1. Navigate to project directory
cd /var/www/moments.thinkable.app/support-agent

# 2. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Follow the command output to enable auto-start

# 3. Check status
pm2 status
pm2 logs support-agent-analytics
```

## Accessing the Service

Once deployed, your service will be available at:

- **Base URL:** `https://moments.thinkable.app/support`
- **Health Check:** `https://moments.thinkable.app/support/health`
- **Daily Analysis:** `https://moments.thinkable.app/support/analyze/daily`
- **Weekly Analysis:** `https://moments.thinkable.app/support/analyze/weekly`
- **Monthly Analysis:** `https://moments.thinkable.app/support/analyze/monthly`

## Testing the Deployment

```bash
# From your local machine or server
curl https://moments.thinkable.app/support/health

# Should return:
# {"status":"healthy","timestamp":"2024-01-xx..."}
```

## Updating the Service

When you need to update the code:

```bash
# On your local machine
./deploy.sh

# The script will automatically:
# - Build the project
# - Upload to server
# - Restart PM2 process
```

## Monitoring

**On the server:**

```bash
# View logs
pm2 logs support-agent-analytics

# Monitor resources
pm2 monit

# Check status
pm2 status

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Service not responding
```bash
# Check if service is running
pm2 status
pm2 restart support-agent-analytics

# Check logs for errors
pm2 logs support-agent-analytics --lines 100
```

### Nginx 502 Bad Gateway
```bash
# Ensure service is running on correct port
pm2 logs support-agent-analytics | grep "running on port"

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log
```

### Firebase connection issues
```bash
# Verify service account key exists
ls -la /var/www/moments.thinkable.app/support-agent/serviceAccountKey.json

# Check permissions
chmod 600 serviceAccountKey.json
```

### Email not sending
```bash
# Test SMTP configuration
cd /var/www/moments.thinkable.app/support-agent
npm run dev
# Check console output for email errors
```

## Security Notes

1. **Never commit sensitive files:**
   - `serviceAccountKey.json`
   - `.env`
   - SSL certificates

2. **Set proper file permissions:**
   ```bash
   chmod 600 .env
   chmod 600 serviceAccountKey.json
   ```

3. **Use environment variables for all secrets**

4. **Enable firewall (if not already):**
   ```bash
   sudo ufw allow 22/tcp  # SSH
   sudo ufw allow 80/tcp  # HTTP
   sudo ufw allow 443/tcp # HTTPS
   sudo ufw enable
   ```

## Backup

Create regular backups of your configuration:

```bash
# On server
cd /var/www/moments.thinkable.app/support-agent
tar -czf backup-$(date +%Y%m%d).tar.gz .env serviceAccountKey.json
```