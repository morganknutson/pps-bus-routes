# Deploying to GoDaddy VPS/Server

Step-by-step guide to deploy your app directly to your GoDaddy server.

## Prerequisites Check

First, we need to check what's installed on your server.

### Step 1: Check Node.js Version

```bash
node --version
```

If you see a version (like `v18.x.x` or `v20.x.x`), great! If not, we'll install it.

### Step 2: Check npm Version

```bash
npm --version
```

### Step 3: Check Git

```bash
git --version
```

### Step 4: Check Your Domain Structure

```bash
ls -la domains/
```

This shows where your domain files are stored.

---

## Installation Steps

### Step 1: Install Node.js (if needed)

If Node.js isn't installed or is too old (< 18):

```bash
# Download Node.js 18.x installer
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

**Note:** If you don't have sudo access, we'll need to use a Node version manager (nvm).

### Step 2: Install Node Version Manager (nvm) - Alternative

If you don't have sudo access:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 18
nvm install 18
nvm use 18

# Verify
node --version
```

### Step 3: Set Up Process Management

You'll need to set up a process manager to keep your app running. Options include:
- systemd (Linux service)
- supervisor
- screen/tmux for development

### Step 4: Clone Your Repository

```bash
# Go to your home directory or a good location
cd ~

# Clone your repo (replace with your actual repo URL)
git clone https://github.com/morganknutson/pps-bus-routes.git

# Or if you want to use a different directory name
git clone https://github.com/morganknutson/pps-bus-routes.git pps-bus-maps
```

### Step 5: Install Dependencies and Build

```bash
# Go into the project directory
cd pps-bus-maps

# Install all dependencies
npm run install:all

# Build the frontend
npm run build:all
```

This will:
- Install root dependencies
- Install frontend dependencies
- Install backend dependencies
- Build the React frontend

### Step 6: Set Up Environment Variables

```bash
# Create .env file in backend directory
cd backend
nano .env
```

Add these lines:
```
NODE_ENV=production
PORT=3001
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### Step 7: Test the Build Locally

```bash
# From the project root
cd backend
node server.js
```

If it starts without errors, press `Ctrl+C` to stop it.

### Step 8: Start the Application

```bash
# Go back to project root
cd ~/pps-bus-maps

# Start the backend server
cd backend
node server.js
```

For production, you'll want to set up a process manager (systemd, supervisor, etc.) to keep the app running and restart it automatically.

### Step 10: Configure Your Domain

Now we need to point your domain to the app. This depends on your server setup.

#### Option A: If you have Apache/Nginx

We need to set up a reverse proxy. Let me know what web server you have:

```bash
# Check for Apache
which apache2
apache2 -v

# Check for Nginx
which nginx
nginx -v
```

#### Option B: Direct Port Access

If your server allows direct port access, you might be able to access it via:
- `http://yourdomain.com:3001`

But this isn't ideal. We want it on port 80/443.

---

## Next Steps

After you run the checks above, share the results and I'll help you:
1. Configure the web server (Apache/Nginx)
2. Set up SSL/HTTPS
3. Point your domain correctly
4. Make sure everything works

---

## Quick Reference Commands

```bash
# Check Node.js
node --version

# Start backend server
cd backend && node server.js

# Check if server is running
lsof -i :3001

# View logs (if using systemd)
journalctl -u pps-bus-maps -f
```





