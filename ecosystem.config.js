/**
 * pm2 process config — keeps Auto-Run running across crashes and
 * reboots on your own machine. See docs/deploy.md for the full setup.
 */
module.exports = {
  apps: [
    {
      name: "auto-run",
      script: "server/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: "30s",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 4173,
      },
      error_file: "data/logs/error.log",
      out_file: "data/logs/out.log",
      time: true,
    },
  ],
};
