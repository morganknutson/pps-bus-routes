# Deployment Guide for PPS Bus Maps

This guide covers several deployment options, from easiest to most advanced. Choose the one that fits your needs and technical comfort level.

## Table of Contents
1. [Quick Overview](#quick-overview)
2. [Option 1: Railway (Easiest - Recommended)](#option-1-railway-easiest---recommended)
3. [Option 2: Render](#option-2-render)
4. [Option 3: Vercel + Railway/Render](#option-3-vercel--railwayrender)
5. [Option 4: VPS (DigitalOcean, Linode, etc.)](#option-4-vps-digitalocean-linode-etc)
6. [Pre-Deployment Checklist](#pre-deployment-checklist)
7. [Post-Deployment Steps](#post-deployment-steps)

---

## Quick Overview

Your app has two parts:
- **Frontend**: React app (needs to be built and served)
- **Backend**: Node.js/Express API server

You can deploy them:
- **Together** on one service (Railway, Render)
- **Separately** (Frontend on Vercel/Netlify, Backend on Railway/Render)

---

## Option 1: Railway (Easiest - Recommended)

Railway can deploy both frontend and backend together. It's beginner-friendly and has a free tier.

### Step 1: Prepare Your Code

1. **Update backend to serve frontend in production:**

First, we need to modify the backend to serve the built frontend files. The backend already has this capability, but we should verify it works.

2. **Create a `.railwayignore` file** (optional, to exclude unnecessary files):
```
node_modules
.git
.env
*.log
data/backups
```

### Step 2: Deploy to Railway

1. **Sign up**: Go to [railway.app](https://railway.app) and sign up with GitHub
2. **New Project**: Click "New Project" → "Deploy from GitHub repo"
3. **Select your repository**: Choose your `pps-bus-maps` repo
4. **Configure the service**:
   - Railway will auto-detect it's a Node.js project
   - Set the **Root Directory** to `backend` (since backend has the main server)
   - Set the **Start Command** to: `node server.js`
   - Set the **Build Command** to: `cd ../frontend && npm install && npm run build && cd ../backend`

5. **Environment Variables** (in Railway dashboard):
   - `NODE_ENV=production`
   - `PORT=3001` (Railway will override this, but set it anyway)
   - `GOOGLE_API_KEY=your_key_here` (optional, if you have one)

6. **Deploy**: Railway will automatically deploy when you push to your main branch

### Step 3: Configure Backend to Serve Frontend

We need to update the backend to serve the built frontend files. This requires a small code change.

**Note**: You'll need to modify `backend/server.js` to serve static files from `frontend/dist` in production.

### Step 4: Set Up Data Persistence

Railway's free tier has ephemeral storage. For the `data/` directory to persist:

1. **Option A**: Use Railway's volume (paid feature)
2. **Option B**: Use external storage (S3, Google Cloud Storage)
3. **Option C**: Store data in a database (PostgreSQL, MongoDB)

For now, the app will work but data won't persist between deployments. This is fine for testing.

---

## Option 2: Render

Similar to Railway, but with a slightly different setup.

### Step 1: Prepare Your Code

Same as Railway - ensure backend can serve frontend.

### Step 2: Deploy to Render

1. **Sign up**: Go to [render.com](https://render.com) and sign up
2. **New Web Service**: Click "New" → "Web Service"
3. **Connect GitHub**: Select your repository
4. **Configure**:
   - **Name**: `pps-bus-maps`
   - **Environment**: `Node`
   - **Root Directory**: `backend`
   - **Build Command**: `cd ../frontend && npm install && npm run build && cd ../backend && npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free (or paid for better performance)

5. **Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=3001`
   - `GOOGLE_API_KEY=your_key_here` (optional)

6. **Deploy**: Render will build and deploy automatically

### Step 3: Persistent Disk (Optional)

Render offers persistent disks on paid plans. For free tier, data is ephemeral.

---

## Option 3: Vercel + Railway/Render

Deploy frontend and backend separately for better performance and easier scaling.

### Frontend on Vercel

1. **Sign up**: Go to [vercel.com](https://vercel.com) and sign up
2. **New Project**: Import your GitHub repository
3. **Configure**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Environment Variables**:
   - `VITE_API_URL=https://your-backend-url.railway.app` (or Render URL)

5. **Update frontend API calls**: Make sure your frontend services use the environment variable for API URL

### Backend on Railway/Render

Follow Option 1 or 2, but:
- Don't serve frontend files from backend
- Set CORS to allow your Vercel domain
- Update backend CORS settings

---

## Option 4: VPS (DigitalOcean, Linode, etc.)

For full control, deploy to a Virtual Private Server. More complex but more flexible.

### Step 1: Set Up VPS

1. **Create a VPS**: 
   - DigitalOcean Droplet (Ubuntu 22.04, $6/month minimum)
   - Linode (similar pricing)
   - AWS EC2, Google Cloud Compute, etc.

2. **SSH into server**:
```bash
ssh root@your-server-ip
```

### Step 2: Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install Nginx (for reverse proxy)
apt install -y nginx
```

### Step 3: Deploy Your Code

```bash
# Clone your repository
git clone https://github.com/yourusername/pps-bus-maps.git
cd pps-bus-maps

# Install dependencies
npm run install:all

# Build frontend
cd frontend
npm run build
cd ..
```

### Step 4: Configure Backend to Serve Frontend

Update `backend/server.js` to serve static files in production (see code changes below).

### Step 5: Set Up PM2

```bash
# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

### Step 6: Configure Nginx

Create `/etc/nginx/sites-available/pps-bus-maps`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/pps-bus-maps /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl restart nginx
```

### Step 7: Set Up SSL (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### Step 8: Set Up Firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Pre-Deployment Checklist

Before deploying, make sure:

- [ ] **Build works**: Run `npm run build` in frontend directory
- [ ] **Backend starts**: Test `cd backend && npm start`
- [ ] **Environment variables**: Document what's needed
- [ ] **Data directory**: Understand what needs to persist
- [ ] **API URLs**: Update frontend to use production API URL
- [ ] **CORS**: Configure backend CORS for production domain
- [ ] **Error handling**: Test error cases
- [ ] **Logs**: Ensure logging works in production

---

## Post-Deployment Steps

1. **Test the deployment**:
   - Visit your deployed URL
   - Test API endpoints
   - Check browser console for errors

2. **Monitor**:
   - Check application logs
   - Monitor error rates
   - Set up uptime monitoring (UptimeRobot, Pingdom)

3. **Set up backups** (if using VPS):
   - Backup `data/` directory regularly
   - Use cron jobs or automated backups

4. **Update documentation**:
   - Document your deployment URL
   - Update any hardcoded URLs in code

---

## Required Code Changes

### 1. Update Backend to Serve Frontend (for single-service deployment)

You'll need to modify `backend/server.js` to serve the built frontend files in production:

```javascript
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ... existing code ...

// Serve static files from frontend/dist in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}
```

### 2. Update Frontend API URL (for separate deployment)

If deploying frontend and backend separately, update your frontend services to use an environment variable:

```typescript
// frontend/src/services/api.ts (or wherever your API base URL is)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

Then set `VITE_API_URL` in your frontend deployment environment.

### 3. Update CORS (for separate deployment)

In `backend/server.js`, update CORS to allow your frontend domain:

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

---

## Troubleshooting

### Build Fails
- Check Node.js version (needs 18+)
- Clear `node_modules` and reinstall
- Check for TypeScript errors: `cd frontend && npm run build`

### Backend Won't Start
- Check environment variables are set
- Check port isn't already in use
- Check logs: `pm2 logs` or service logs

### Frontend Can't Reach Backend
- Check CORS settings
- Verify API URL is correct
- Check firewall rules (if VPS)

### Data Not Persisting
- Check if using ephemeral storage (free tiers)
- Set up persistent storage or database
- Consider moving data to external storage

---

## Recommended Approach for Beginners

**Start with Railway (Option 1)**:
- Easiest setup
- Free tier available
- Automatic deployments
- Good documentation

Once comfortable, you can:
- Move to separate deployments (Vercel + Railway) for better performance
- Move to VPS for full control

---

## Need Help?

- Railway: [docs.railway.app](https://docs.railway.app)
- Render: [render.com/docs](https://render.com/docs)
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- PM2: [pm2.keymetrics.io](https://pm2.keymetrics.io)


