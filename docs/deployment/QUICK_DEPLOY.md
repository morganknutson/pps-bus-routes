# Quick Deployment Guide

**Easiest option for beginners: Railway**

## Step-by-Step: Deploy to Railway (5 minutes)

### 1. Prepare Your Code
✅ Already done! The code is ready for deployment.

### 2. Sign Up for Railway
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Sign up with GitHub (easiest option)

### 3. Deploy Your App
1. Click "New Project" → "Deploy from GitHub repo"
2. Select your `pps-bus-maps` repository
3. Railway will automatically detect it's a Node.js project

### 4. Configure Settings
In the Railway dashboard, go to your service settings:

**Settings Tab:**
- **Root Directory**: Leave empty (or set to `.`)
- **Build Command**: `npm run build:all`
- **Start Command**: `npm run start:production`

**Variables Tab:**
Add these environment variables:
- `NODE_ENV` = `production`
- `PORT` = `3002` (Railway will override this, but set it anyway)
- `GOOGLE_API_KEY` = `your_key_here` (optional - only if you have one)

### 5. Deploy!
Railway will automatically:
- Install dependencies
- Build the frontend
- Start the backend server
- Give you a public URL (like `https://your-app.railway.app`)

### 6. Test It
1. Visit your Railway URL
2. The app should load!
3. Test the map and routes

---

## What Changed?

I've updated your code to support deployment:

1. **Backend now serves frontend** in production (`backend/server.js`)
2. **Added build scripts** (`package.json`)
3. **Created Railway config** (`railway.json`)
4. **Created Render config** (`render.yaml`)

---

## Alternative: Render (Similar to Railway)

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New" → "Web Service"
4. Select your repository
5. Use these settings:
   - **Root Directory**: `.`
   - **Build Command**: `npm run build:all`
   - **Start Command**: `npm run start:production`
   - **Environment**: `Node`
6. Add environment variables (same as Railway)
7. Deploy!

---

## Troubleshooting

**Build fails?**
- Check Railway/Render logs
- Make sure Node.js version is 18+
- Try running `npm run build:all` locally first

**App loads but API doesn't work?**
- Check that backend is running (check logs)
- Verify environment variables are set
- Check CORS settings (should be fine if frontend/backend are together)

**Can't see the app?**
- Wait a few minutes for build to complete
- Check the deployment logs
- Make sure the build succeeded

---

## Next Steps

Once deployed:
1. **Set up a custom domain** (optional, in Railway/Render settings)
2. **Monitor logs** (Railway/Render dashboard)
3. **Set up backups** for your `data/` directory (if needed)

---

## Need More Help?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- More deployment options
- VPS deployment (advanced)
- Detailed troubleshooting
- Production optimizations










