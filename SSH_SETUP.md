# Setting Up SSH Key Access to GoDaddy Server

## Overview

You generated a key on the server, but the proper way is to:
1. Generate a key pair on your **local Mac**
2. Copy the **public key** to your server
3. Use the **private key** (stays on your Mac) to connect

---

## Step 1: Generate SSH Key on Your Local Mac

Open Terminal on your Mac and run:

```bash
# Generate a new SSH key pair
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# When prompted:
# - File location: Press Enter (uses default: ~/.ssh/id_rsa)
# - Passphrase: You can set one or leave empty (empty is easier but less secure)
```

This creates:
- **Private key:** `~/.ssh/id_rsa` (keep this secret, never share)
- **Public key:** `~/.ssh/id_rsa.pub` (this is safe to share)

---

## Step 2: Copy Your Public Key to the Server

### Option A: Using ssh-copy-id (Easiest)

```bash
# Replace with your actual server details
ssh-copy-id yhfnajldk63m@your-server-ip-or-hostname

# Or if you know the exact hostname:
ssh-copy-id yhfnajldk63m@p3plzcpnl496326.prod.phx3.secureserver.net
```

You'll be prompted for your password one last time, then it will copy your public key.

### Option B: Manual Copy (If ssh-copy-id doesn't work)

```bash
# 1. Display your public key
cat ~/.ssh/id_rsa.pub

# 2. Copy the entire output (it's one long line)

# 3. SSH into your server (using password)
ssh yhfnajldk63m@your-server-hostname

# 4. On the server, run:
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Replace `PASTE_YOUR_PUBLIC_KEY_HERE` with the key you copied from step 1.

---

## Step 3: Test SSH Connection

From your Mac:

```bash
# Try connecting (should work without password now)
ssh yhfnajldk63m@your-server-hostname
```

If it works without asking for a password, you're all set! ✅

---

## Step 4: Create SSH Config (Optional but Helpful)

Create a config file to make connecting easier:

```bash
# On your Mac, create/edit SSH config
nano ~/.ssh/config
```

Add this (replace with your actual details):

```
Host godaddy
    HostName your-server-hostname-or-ip
    User yhfnajldk63m
    IdentityFile ~/.ssh/id_rsa
    Port 22
```

Then save (`Ctrl+X`, `Y`, `Enter`).

Now you can just type:
```bash
ssh godaddy
```

---

## Step 5: Add the Server's Public Key to Your Server (Clean Up)

Since you generated a key on the server, you can add it to authorized_keys too (optional):

```bash
# On the server, run:
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## Troubleshooting

### "Permission denied (publickey)"

- Make sure you copied the **public key** (id_rsa.pub), not the private key
- Check file permissions on server: `chmod 600 ~/.ssh/authorized_keys`
- Check directory permissions: `chmod 700 ~/.ssh`

### "Could not resolve hostname"

- Make sure you're using the correct hostname or IP address
- Check with GoDaddy support if you're not sure

### Still asking for password

- Verify the public key is in `~/.ssh/authorized_keys` on the server
- Check file permissions (should be 600 for authorized_keys, 700 for .ssh directory)

---

## Security Notes

- **Never share your private key** (`~/.ssh/id_rsa`)
- **Public keys are safe** to share (`~/.ssh/id_rsa.pub`)
- Consider using a passphrase for extra security
- You can have multiple public keys in `authorized_keys` (one per line)

---

## Next Steps

Once SSH key access is working:
1. You can easily connect: `ssh godaddy` (or your hostname)
2. We'll proceed with deploying your app
3. You can use `scp` or `rsync` to transfer files easily











