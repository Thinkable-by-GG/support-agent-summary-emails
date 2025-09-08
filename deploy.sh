#!/bin/bash

# Deployment script for Support Agent Analytics Service
# Deploys to moments.thinkable.app/support

SERVER_IP="63.178.138.63"
SERVER_USER="ubuntu"
SSH_KEY="/Users/gurilany/samuramu.pem"
REMOTE_DIR="/var/www/moments.thinkable.app/support-agent"
LOCAL_DIR="."

echo "🚀 Starting deployment to moments.thinkable.app/support..."

# Build the project
echo "📦 Building project..."
npm run build

# Create deployment package
echo "📋 Creating deployment package..."
tar -czf deploy.tar.gz \
  dist/ \
  src/ \
  package.json \
  package-lock.json \
  ecosystem.config.js \
  tsconfig.json \
  .env.example

# Upload to server
echo "📤 Uploading to server..."
sftp -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" <<EOF
cd /var/www/moments.thinkable.app
mkdir -p support-agent
cd support-agent
put deploy.tar.gz
exit
EOF

# Extract and setup on server
echo "🔧 Setting up on server..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
cd /var/www/moments.thinkable.app/support-agent

# Extract files
tar -xzf deploy.tar.gz
rm deploy.tar.gz

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Please configure .env file on the server"
fi

# Check if serviceAccountKey.json exists
if [ ! -f serviceAccountKey.json ]; then
  echo "⚠️  Please upload serviceAccountKey.json to the server"
fi

# Restart with PM2
pm2 stop support-agent-analytics 2>/dev/null || true
pm2 delete support-agent-analytics 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "✅ Deployment complete!"
ENDSSH

# Clean up local deployment package
rm -f deploy.tar.gz

echo "🎉 Deployment finished!"
echo ""
echo "Next steps:"
echo "1. SSH into server: ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP"
echo "2. Navigate to: cd /var/www/moments.thinkable.app/support-agent"
echo "3. Upload serviceAccountKey.json if not already present"
echo "4. Configure .env file with your settings"
echo "5. Restart service: pm2 restart support-agent-analytics"