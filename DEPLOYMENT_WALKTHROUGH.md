# Step-by-Step Deployment Walkthrough

Follow these steps exactly to deploy your app to Railway.

## Step 1: Commit Your Changes to GitHub

First, we need to save all the deployment changes to your GitHub repository.

### 1.1 Check if you have a GitHub repository

Do you have this code in a GitHub repository? If yes, continue. If no, we'll need to create one first.

### 1.2 Commit and push the changes

Open your terminal in the project folder and run:

```bash
# Add all the new files
git add .

# Commit with a message
git commit -m "Add deployment configuration"

# Push to GitHub
git push
```

**What this does:** Saves all the deployment files (railway.json, updated server.js, etc.) to your GitHub repository so Railway can access them.

---

## Step 2: Sign Up for Railway

### 2.1 Go to Railway

1. Open your web browser
2. Go to: **https://railway.app**
3. Click the **"Start a New Project"** button (or "Login" if you already have an account)

### 2.2 Sign Up

1. Click **"Login with GitHub"** (this is the easiest option)
2. Authorize Railway to access your GitHub account
3. You'll be redirected back to Railway

**Why GitHub?** Railway needs access to your code repository to deploy it.

---

## Step 3: Create a New Project

### 3.1 Start Deployment

1. In Railway dashboard, click **"New Project"** (big button, usually at the top)
2. Select **"Deploy from GitHub repo"**
3. You'll see a list of your GitHub repositories

### 3.2 Select Your Repository

1. Find **"pps-bus-maps"** (or whatever your repo is named) in the list
2. Click on it
3. Railway will start setting up your project

**What happens:** Railway creates a new "project" and will try to automatically detect what kind of app this is.

---

## Step 4: Configure Your Service

Railway will create a "service" for your app. We need to configure it properly.

### 4.1 Open Service Settings

1. Click on your service (it might be named "pps-bus-maps" or similar)
2. Click the **"Settings"** tab (or the gear icon)
3. Scroll down to find the configuration options

### 4.2 Set Root Directory

1. Find **"Root Directory"** field
2. Leave it **EMPTY** (or set it to `.`)
   - This tells Railway the root of your project is at the top level

### 4.3 Set Build Command

1. Find **"Build Command"** field
2. Enter exactly: `npm run build:all`
   - This tells Railway to install all dependencies and build the frontend

### 4.4 Set Start Command

1. Find **"Start Command"** field
2. Enter exactly: `npm run start:production`
   - This tells Railway how to start your app in production mode

### 4.5 Save Settings

1. Click **"Save"** or the checkmark button
2. Railway will automatically start building your app

**What happens:** Railway will:
- Install all dependencies (root, frontend, backend)
- Build your React frontend
- Start your backend server

This might take 3-5 minutes the first time.

---

## Step 5: Set Environment Variables

Environment variables are settings your app needs to run properly.

### 5.1 Open Variables Tab

1. In your service, click the **"Variables"** tab
2. You'll see a list of environment variables (might be empty at first)

### 5.2 Add NODE_ENV

1. Click **"New Variable"** or **"Raw Editor"**
2. Add this variable:
   - **Key:** `NODE_ENV`
   - **Value:** `production`
3. Click **"Add"** or **"Save"**

### 5.3 Add PORT (Optional)

Railway usually sets this automatically, but you can add:
- **Key:** `PORT`
- **Value:** `3001`

### 5.4 Add Google API Key (Optional - Only if you have one)

If you have a Google Drive API key:
- **Key:** `GOOGLE_API_KEY`
- **Value:** `your_actual_api_key_here`

**Note:** Your app works without this! It's optional.

### 5.5 Save Variables

1. Make sure all variables are saved
2. Railway will automatically restart your app with the new variables

---

## Step 6: Wait for Deployment

### 6.1 Watch the Logs

1. Click the **"Deployments"** tab or **"Logs"** tab
2. You'll see Railway building your app:
   - Installing dependencies
   - Building frontend
   - Starting server

### 6.2 Check for Errors

- **Green checkmark** = Success! ✅
- **Red X** = Error ❌ (we'll troubleshoot if this happens)

The build usually takes 3-5 minutes the first time.

---

## Step 7: Get Your App URL

### 7.1 Find Your Domain

1. Once deployment is complete, go to the **"Settings"** tab
2. Scroll down to **"Domains"** section
3. You'll see a URL like: `https://your-app-name.up.railway.app`

### 7.2 Copy the URL

1. Click the URL to copy it
2. Or click **"Generate Domain"** if you don't see one

**This is your live app URL!** 🎉

---

## Step 8: Test Your App

### 8.1 Open Your App

1. Open the URL in a new browser tab
2. Your app should load!

### 8.2 Test Features

1. Check if the map loads
2. Try selecting a school
3. Try loading routes
4. Check the browser console (F12) for any errors

---

## Troubleshooting

### Build Fails

**Problem:** Railway shows a red X and build fails

**Solutions:**
1. Check the logs - scroll through to see the error
2. Common issues:
   - Node version too old (needs 18+)
   - Missing dependencies
   - Build script error

**Fix:** Share the error message and we can troubleshoot

### App Loads But API Doesn't Work

**Problem:** Frontend loads but can't connect to backend

**Solutions:**
1. Check that `NODE_ENV=production` is set
2. Check Railway logs for backend errors
3. Make sure the backend is running (check logs)

### Can't See the App

**Problem:** URL shows error or blank page

**Solutions:**
1. Wait a few minutes - first deployment can be slow
2. Check Railway logs for errors
3. Make sure build completed successfully
4. Try refreshing the page

---

## Next Steps After Deployment

### Set Up Custom Domain (Optional)

1. In Railway Settings → Domains
2. Click "Custom Domain"
3. Enter your domain name
4. Follow Railway's instructions to configure DNS

### Monitor Your App

1. Check Railway dashboard regularly
2. Watch logs for errors
3. Monitor usage (Railway shows this)

### Update Your App

Whenever you make changes:
1. Commit and push to GitHub
2. Railway automatically redeploys!
3. Wait a few minutes for new version

---

## Quick Reference: Railway Settings Summary

**Root Directory:** (empty or `.`)

**Build Command:** `npm run build:all`

**Start Command:** `npm run start:production`

**Environment Variables:**
- `NODE_ENV` = `production`
- `PORT` = `3001` (optional, Railway sets this)
- `GOOGLE_API_KEY` = (optional, only if you have one)

---

## Need Help?

If you get stuck at any step:
1. Check the Railway logs (very helpful!)
2. Share the error message
3. Check that all settings match exactly what's above

Good luck! 🚀









