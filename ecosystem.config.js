module.exports = {
  apps: [
    {
      name: 'telegram-todo-api',
      script: 'npm',
      args: 'run dev',
      cwd: './apps/api',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'telegram-todo-bot',
      script: 'npm',
      args: 'run dev',
      cwd: './apps/bot',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'telegram-todo-web',
      script: 'npm',
      args: 'run dev',
      cwd: './apps/web',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    }
  ]
};
