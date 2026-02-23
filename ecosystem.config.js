/**
 * Configuração PM2 para execução 24/7
 * Versão: 2.5.0 - Prompt 7 (NF2)
 * 
 * Uso:
 * - Iniciar: pm2 start ecosystem.config.js
 * - Status: pm2 status
 * - Logs: pm2 logs acai-bot
 * - Parar: pm2 stop acai-bot
 * - Reiniciar: pm2 restart acai-bot
 * - Remover: pm2 delete acai-bot
 * 
 * Para iniciar com o sistema:
 * - pm2 startup
 * - pm2 save
 */

module.exports = {
  apps: [{
    name: 'acai-bot',
    script: 'bot.js',
    cwd: __dirname,
    
    // Reinício automático
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Tentativas de reinício
    max_restarts: 10,
    restart_delay: 5000, // 5 segundos entre reinícios
    
    // Logs
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    
    // Ambiente
    env: {
      NODE_ENV: 'production',
      WEB_VERSION_REMOTE: '0',
    },
    
    // Configurações de processo
    instances: 1,
    exec_mode: 'fork',
    
    // Kill timeout - aumentado para 30s (v2.5.8/v2.5.10 - permite encerramento limpo)
    kill_timeout: 30000,
    
    // Ignorar arquivos no watch
    ignore_watch: [
      'node_modules',
      'logs',
      '.wwebjs_auth',
      '.wwebjs_cache',
      'data',
    ],
  }],
};
