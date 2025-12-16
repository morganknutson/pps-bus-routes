# PM2 Process Manager Setup

The servers are now managed by PM2, which provides:
- **Auto-restart on crash**: Servers automatically restart if they crash
- **Process monitoring**: Monitor server status, CPU, and memory usage
- **Log management**: Centralized logging with rotation
- **Persistent processes**: Servers survive terminal closures

## Quick Commands

```bash
# Start servers
npm run pm2:start

# Stop servers
npm run pm2:stop

# Restart servers
npm run pm2:restart

# Check status
npm run pm2:status

# View logs (all servers)
npm run pm2:logs

# View logs (specific server)
pm2 logs pps-backend
pm2 logs pps-frontend

# Monitor (real-time dashboard)
npm run pm2:monit

# Save current process list
npm run pm2:save

# Delete all processes
npm run pm2:delete
```

## Auto-Restart Configuration

Both servers are configured to:
- **Auto-restart**: Enabled (restarts immediately on crash)
- **Max restarts**: 10 restarts within 10 seconds
- **Min uptime**: 10 seconds (prevents restart loops)
- **Memory limit**: 500MB (restarts if exceeded)

## Logs

Logs are stored in the `logs/` directory:
- `logs/backend-error.log` - Backend error logs
- `logs/backend-out.log` - Backend output logs
- `logs/backend-combined.log` - Backend combined logs
- `logs/frontend-error.log` - Frontend error logs
- `logs/frontend-out.log` - Frontend output logs
- `logs/frontend-combined.log` - Frontend combined logs

## Starting on System Boot (Optional)

To make PM2 start servers automatically on system boot:

```bash
# Generate startup script
pm2 startup

# Follow the instructions it provides, then:
npm run pm2:save
```

## Development vs Production

- **Development**: Use `npm run dev` for file watching and hot reload
- **Production**: Use `npm run pm2:start` for stable, monitored processes

## Troubleshooting

If servers won't start:
1. Check logs: `npm run pm2:logs`
2. Check status: `npm run pm2:status`
3. Delete and restart: `npm run pm2:delete && npm run pm2:start`

If a server keeps crashing:
1. Check the error logs in `logs/` directory
2. Verify environment variables in `backend/.env`
3. Check port availability: `lsof -i :3001` and `lsof -i :5173`




