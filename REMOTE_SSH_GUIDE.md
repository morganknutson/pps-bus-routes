# Remote - SSH Guide for Cursor

## Quick Start

### 1. Edit Your SSH Config

Edit `~/.ssh/config` and replace `YOUR_SERVER_HOSTNAME_OR_IP` with your actual server details:

```bash
nano ~/.ssh/config
```

Example:
```
Host godaddy
    HostName p3plzcpnl496326.prod.phx3.secureserver.net
    User yhfnajldk63m
    IdentityFile ~/.ssh/id_rsa
    Port 22
    ForwardAgent yes
```

### 2. Connect via Cursor UI

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: `Remote-SSH: Connect to Host...`
3. Select `godaddy` (or your hostname)
4. Wait for connection (first time will install Remote Server)
5. Open a folder on the remote machine when prompted

### 3. Open Remote Folder

After connecting, you'll be prompted to open a folder. Navigate to your project:

- `/home/yhfnajldk63m/pps-bus-maps` (if you cloned the repo)
- Or any other folder on the remote server

## Using CLI to Open Remote Folders

### Basic Syntax

```bash
cursor --folder-uri vscode-remote://ssh-remote+<hostname>/<folder_path>
```

### Examples

**Using SSH config hostname:**
```bash
cursor --folder-uri vscode-remote://ssh-remote+godaddy/home/yhfnajldk63m/pps-bus-maps
```

**With custom connection (user, port, IP):**
```bash
SSH_CONF='{"hostName":"yhfnajldk63m@p3plzcpnl496326.prod.phx3.secureserver.net -p 22"}'
SSH_HEX_CONF=$(printf "$SSH_CONF" | od -A n -t x1 | tr -d '[\n\t ]')
cursor --folder-uri vscode-remote://ssh-remote+${SSH_HEX_CONF}/home/yhfnajldk63m/pps-bus-maps
```

## Common Tasks

### Opening Your Project on Remote Server

If your project is at `/home/yhfnajldk63m/pps-bus-maps`:

```bash
cursor --folder-uri vscode-remote://ssh-remote+godaddy/home/yhfnajldk63m/pps-bus-maps
```

### Switching Between Local and Remote

- **Local**: File → Open Folder (normal)
- **Remote**: Use Remote-SSH command or CLI

### Viewing Remote Connection

- Look at the bottom-left corner of Cursor
- You'll see: `SSH: godaddy` when connected
- Click it to disconnect or change hosts

## Troubleshooting

### "Permission denied (publickey)"

1. Make sure your SSH key is set up:
   ```bash
   ssh-copy-id yhfnajldk63m@your-server-hostname
   ```

2. Test SSH connection first:
   ```bash
   ssh godaddy
   ```

3. If that works, Remote-SSH should work too

### "Could not resolve hostname"

- Check your SSH config file (`~/.ssh/config`)
- Verify the hostname/IP is correct
- Test with: `ssh godaddy` first

### "Remote server installation failed"

- Make sure the remote server has:
  - `bash` (or `powershell` on Windows)
  - `wget` or `curl`
  - SSH server with TCP Forwarding enabled

- Check server requirements:
  ```bash
  ssh godaddy "which bash && which wget"
  ```

### Connection is slow

- Check your internet connection
- Try connecting from terminal first: `ssh godaddy`
- Check server resources: `ssh godaddy "top"`

## Security Notes

⚠️ **Only connect to trusted remote machines.** A compromised remote system could potentially execute code on your local machine through the Remote-SSH connection.

## Tips

1. **Save Remote Workspace**: After opening a remote folder, save it as a workspace file (`.code-workspace`) to quickly reconnect later

2. **Multiple Connections**: You can have multiple Cursor windows open - some local, some remote

3. **Terminal Access**: When connected remotely, the integrated terminal runs commands on the remote server automatically

4. **Extensions**: Some extensions need to be installed on the remote server. Cursor will prompt you when needed.

5. **File Operations**: All file operations (create, edit, delete) happen directly on the remote server - no local copies needed

## Next Steps

Once connected:
1. Open your project folder on the remote server
2. Install any needed extensions (Cursor will prompt)
3. Start developing as if you were working locally!
4. Your code runs on the remote server, not your local machine






