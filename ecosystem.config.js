/**
 * PM2 Ecosystem Configuration
 * Manages both frontend and backend servers with auto-restart
 */

module.exports = {
  apps: [
    {
      name: 'pps-backend',
      script: './backend/server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false, // Disable file watching (use --watch flag in dev mode)
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      merge_logs: true,
      kill_timeout: 5000,
    },
    {
      name: 'pps-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      merge_logs: true,
      kill_timeout: 5000,
    },
  ],
};

