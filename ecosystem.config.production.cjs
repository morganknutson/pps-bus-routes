/**
 * PM2 Ecosystem Configuration for Production
 * Single backend process that serves both API and frontend static files
 */

module.exports = {
  apps: [
    {
      name: 'pps-bus-maps',
      script: 'server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_file: '../logs/backend-combined.log',
      time: true,
      merge_logs: true,
      kill_timeout: 5000,
    },
  ],
};


