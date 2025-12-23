import 'dotenv/config';

export const env = {
  BOT_TOKEN: process.env.BOT_TOKEN || '8450757648:AAEk_lxB5x8-vGGueYhM6vAATAhMYaNVa1g',
  GROUP_ID: Number(process.env.GROUP_ID),
  ALLOWED_BOT_ID: Number(process.env.ALLOWED_BOT_ID) || 6285996403,
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8080'
};
