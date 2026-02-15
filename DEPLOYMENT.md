# 🚀 Deployment Guide - DocDocPartner

## Railway Deployment

### Prerequisites
- Railway account (https://railway.app)
- Railway CLI installed: `npm i -g @railway/cli`
- GitHub repository connected

### 1️⃣ Initial Setup

#### Login to Railway
```bash
railway login
```

#### Link Project
```bash
railway link
```

### 2️⃣ Environment Variables

Set the following environment variables in Railway dashboard or via CLI:

```bash
# Database (Auto-configured by Railway MySQL plugin)
DATABASE_URL=mysql://user:password@host:port/database

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Webhook Domain (Set after first deployment)
WEBHOOK_DOMAIN=https://your-app.railway.app

# JWT Secret (Generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Node Environment
NODE_ENV=production
PORT=3000

# Manus OAuth (Optional, for admin panel)
VITE_APP_ID=
OAUTH_SERVER_URL=https://oauth.manus.space
OWNER_OPEN_ID=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

#### Via CLI:
```bash
railway variables set TELEGRAM_BOT_TOKEN="your_token"
railway variables set JWT_SECRET="your_secret"
railway variables set NODE_ENV="production"
```

### 3️⃣ Database Setup

1. Add MySQL plugin in Railway dashboard
2. Copy `DATABASE_URL` from plugin settings
3. Run migrations:
```bash
railway run pnpm db:push
```

### 4️⃣ Deploy

#### Automatic deployment (recommended)
Push to GitHub main branch - Railway will auto-deploy

#### Manual deployment via CLI
```bash
railway up
```

### 5️⃣ Post-Deployment

1. Get your Railway app URL: `https://your-project.railway.app`
2. Update `WEBHOOK_DOMAIN` environment variable
3. Restart the service to apply webhook changes
4. Test Telegram bot: `/start` in @docpartnerbot

### 6️⃣ Monitoring

```bash
# Check deployment status
railway status

# View logs
railway logs

# Open app in browser
railway open
```

### 🔧 Troubleshooting

#### Bot not responding
1. Check webhook status:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```
2. Verify `WEBHOOK_DOMAIN` matches your Railway URL
3. Check server logs: `railway logs`

#### Database connection failed
1. Verify `DATABASE_URL` is correct
2. Run migrations: `railway run pnpm db:push`
3. Check MySQL plugin status in Railway dashboard

#### Build failed
1. Check build logs in Railway dashboard
2. Verify all dependencies in `package.json`
3. Test build locally: `pnpm run build`

### 📊 Health Checks

Railway will perform health checks on `/` endpoint.
Timeout: 300 seconds
Restart policy: On failure (max 10 retries)

---

**Useful Commands:**

```bash
# List all services
railway service

# Switch environment
railway environment

# Open Railway dashboard
railway open

# Unlink project
railway unlink
```
