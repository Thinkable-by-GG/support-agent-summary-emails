# Support Agent Analytics Service

A Node.js service that analyzes Firestore chat logs from your tech support AI bot and provides insights, aggregations, and email notifications.

## Features

- 📊 Comprehensive analytics on chat logs
- 📈 Key metrics tracking (resolution rate, user satisfaction, error rate)
- 🔔 Automated alerts for performance issues
- 💡 AI-powered recommendations for improvements
- 📧 Scheduled email reports
- 🕐 Configurable analysis schedules
- 🌐 REST API for on-demand analysis

## Prerequisites

- Node.js 16+
- Firebase project with Firestore database
- Service account key from Firebase Console
- Ubuntu/Linux server with MySQL (optional for historical data)
- SMTP credentials for email notifications

## Installation

### Quick Setup

```bash
./setup.sh
```

### Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Download your Firebase service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Generate new private key
   - Save as `serviceAccountKey.json` in project root

4. Configure `.env` file with your settings

5. Build the project:
```bash
npm run build
```

## Configuration

Edit `.env` file with your settings:

```env
# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY=./serviceAccountKey.json

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_TO=recipient@example.com

# Server
PORT=3000

# Schedule (cron format)
ANALYSIS_SCHEDULE=0 9 * * *  # Daily at 9 AM
```

## Usage

### Development
```bash
npm run dev
```

### Production with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # To auto-start on server reboot
```

### Production with systemd
Create `/etc/systemd/system/support-agent.service`:

```ini
[Unit]
Description=Support Agent Analytics Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/support-agent
ExecStart=/usr/bin/node /path/to/support-agent/dist/app.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable support-agent
sudo systemctl start support-agent
```

## API Endpoints

- `GET /health` - Health check
- `POST /analyze` - Manual analysis with custom time range
- `GET /analyze/daily` - Last 24 hours analysis
- `GET /analyze/weekly` - Last 7 days analysis
- `GET /analyze/monthly` - Last 30 days analysis

### Example API Usage

```bash
# Daily analysis
curl http://localhost:3000/analyze/daily

# Custom time range
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"hours": 48}'
```

## Analytics Features

### Key Metrics
- Total conversations
- Unique users
- Average session duration
- User satisfaction rating
- Resolution rate
- Error rate

### Insights
- Traffic patterns and peak hours
- Common issues and error patterns
- User sentiment analysis
- Response time statistics
- Category distribution
- Daily/weekly trends

### Alerts
- High error rates
- Low resolution rates
- Poor user satisfaction
- Performance issues

### Recommendations
- Bot knowledge gaps
- Resource scaling suggestions
- Content improvements
- Workflow optimizations

## Firestore Data Structure

The service expects chat logs in the `chat_agent_logs` collection with this structure:

```typescript
{
  conversationId: string
  userId: string
  userMessage: string
  botResponse: string
  timestamp: Timestamp
  sessionDuration: number (seconds)
  resolved: boolean
  rating: number (1-5)
  category: string
  error: boolean
  errorMessage: string
  metadata: {
    responseTime: number (ms)
    // other custom fields
  }
}
```

## Monitoring

### PM2 Monitoring
```bash
pm2 status
pm2 logs support-agent-analytics
pm2 monit
```

### Systemd Logs
```bash
sudo journalctl -u support-agent -f
```

## Troubleshooting

1. **Firebase connection issues**
   - Verify service account key path
   - Check file permissions
   - Ensure project ID matches

2. **Email not sending**
   - Verify SMTP credentials
   - Check firewall/port access
   - Enable "Less secure app access" for Gmail

3. **High memory usage**
   - Adjust time ranges for analysis
   - Implement pagination for large datasets
   - Increase server resources

## License

MIT