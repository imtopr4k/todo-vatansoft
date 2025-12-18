const fetch = require('node-fetch');

const token = '8450757648:AAEk_lxB5x8-vGGueYhM6vAATAhMYaNVa1g';

async function checkBot() {
  console.log('Checking bot info...');
  
  // Get bot info
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const meData = await meRes.json();
  console.log('Bot info:', meData);
  
  // Get webhook info
  const webhookRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const webhookData = await webhookRes.json();
  console.log('Webhook info:', webhookData);
  
  // Delete webhook if exists
  if (webhookData.result && webhookData.result.url) {
    console.log('Deleting webhook...');
    const delRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    const delData = await delRes.json();
    console.log('Delete result:', delData);
  }
}

checkBot().catch(console.error);
