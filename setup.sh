#!/bin/bash

echo "Setting up Support Agent Analytics Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Copy environment file
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env file with your configuration"
fi

# Build the TypeScript project
echo "Building project..."
npm run build

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Download your Firebase service account key from Firebase Console"
echo "2. Save it as serviceAccountKey.json in this directory"
echo "3. Edit .env file with your configuration"
echo "4. Run 'npm run dev' to test locally"
echo "5. Run 'pm2 start ecosystem.config.js' to run in production"