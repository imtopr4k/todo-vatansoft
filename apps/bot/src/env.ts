import 'dotenv/config';

export const env = {
  BOT_TOKEN: process.env.BOT_TOKEN || '8450757648:AAEk_lxB5x8-vGGueYhM6vAATAhMYaNVa1g',
  GROUP_ID: Number(process.env.GROUP_ID),
  API_BASE_URL: process.env.API_BASE_URL || 'http://92.205.163.182:8081'
};
