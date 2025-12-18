const { Telegraf } = require('telegraf');

const token = '8450757648:AAEk_lxB5x8-vGGueYhM6vAATAhMYaNVa1g';

console.log('Testing bot token...');
console.log('Token:', token.substring(0, 15) + '...');

const bot = new Telegraf(token);

console.log('Registering /start handler...');
bot.start(async (ctx) => {
  console.log('/start called');
  ctx.reply('Hello!');
});

console.log('Registering message handler...');
bot.on('message', async (ctx) => {
  console.log('Message received');
});

console.log('Launching bot...');
bot.launch()
  .then(() => {
    console.log('✅ Bot started successfully!');
  })
  .catch((err) => {
    console.error('❌ Bot failed to start:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
