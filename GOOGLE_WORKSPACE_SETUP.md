# Google Workspace Setup for Your Mail Account

## Step-by-Step Google Workspace Configuration

### 1. Create/Configure the Mail Account

**In Google Workspace Admin Console:**

1. Go to [admin.google.com](https://admin.google.com)
2. Navigate to **Directory** → **Users**
3. Create user `your-mailer@yourdomain.com` if it doesn't exist:
   - First name: "Support"
   - Last name: "Mailer"
   - Primary email: your-mailer@yourdomain.com
   - Set a temporary password

### 2. Enable 2-Step Verification (Required for App Passwords)

**Option A: For the specific user (recommended):**
1. In Admin Console → **Directory** → **Users**
2. Click on `your-mailer@yourdomain.com`
3. Go to **Security** tab
4. Click **2-Step Verification** → **Get Started**
5. Follow setup process (use your phone for verification)

**Option B: Organization-wide:**
1. Go to **Security** → **2-step verification**
2. Turn on **Allow users to turn on 2-step verification**
3. Then follow Option A for the specific user

### 3. Enable Less Secure App Access (Alternative Method)

**If you want to avoid App Passwords:**
1. Go to **Security** → **Less secure apps**
2. Turn ON **Allow users to manage their access to less secure apps**
3. Then as the user your-mailer@yourdomain.com:
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Security → Less secure app access → Turn ON

### 4. Generate App Password (Recommended Method)

**As the your-mailer@yourdomain.com user:**
1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click **Security** in left sidebar
3. Under "Signing in to Google" click **2-Step Verification**
4. Scroll down and click **App passwords**
5. Click **Select app** → **Mail**
6. Click **Select device** → **Other** → Type: "Support Analytics Service"
7. Click **GENERATE**
8. **Copy the 16-character password** (example: `abcd efgh ijkl mnop`)

### 5. Update Server Configuration

**SSH into your server and update the password:**

```bash
ssh -i /Users/gurilany/samuramu.pem ubuntu@63.178.138.63
cd /var/www/moments.thinkable.app/support-agent
nano .env
```

**Replace this line:**
```
SMTP_PASS=your-app-password
```

**With your actual app password:**
```
SMTP_PASS=abcd efgh ijkl mnop
```

**Save and restart:**
```bash
pm2 restart support-agent-analytics
```

### 6. Alternative SMTP Settings

**If Gmail doesn't work, try these alternatives:**

**For Google Workspace (sometimes works better):**
```env
SMTP_HOST=smtp-relay.gmail.com
SMTP_PORT=587
SMTP_USER=your-mailer@yourdomain.com
SMTP_PASS=your-app-password
```

**Or for port 465 (SSL):**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-mailer@yourdomain.com
SMTP_PASS=your-app-password
```

### 7. Test Email Functionality

**After updating the password:**
```bash
# Test the service
curl https://moments.thinkable.app/support/analyze/daily
```

## Current Configuration Summary:
- **Sender:** your-mailer@yourdomain.com
- **Receiver:** your-support@yourdomain.com  
- **Service:** Daily analytics reports at 9 AM UTC
- **Content:** HTML email with comprehensive chat bot analytics

## Troubleshooting

**If you get "Username and Password not accepted":**
1. Double-check the app password is correct (no spaces)
2. Try enabling "Less secure app access" as backup
3. Check if 2FA is properly enabled for your-mailer@yourdomain.com
4. Try the alternative SMTP settings above

**If you get "Must issue a STARTTLS command first":**
- The current settings should handle this automatically
- Port 587 with STARTTLS is correctly configured

**If emails still don't work:**
- We can switch to a transactional email service like SendGrid
- Or set up SMTP relay through Google Workspace directly