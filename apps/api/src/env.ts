import 'dotenv/config';

export const env = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 8080,
  MONGO_URI: process.env.MONGO_URI || 'mongodb+srv://erenasik1211_db_user:R4RSDeFPjeSXxB10@telegramtodo.gnsvcdl.mongodb.net/TelegramToDo?retryWrites=true&w=majority',
  MONGO_DBNAME: process.env.MONGO_DBNAME || 'TelegramToDo',
  JWT_SECRET: process.env.JWT_SECRET || 'O19z07L19E98M',
  SESSION_MAX_IDLE: Number(process.env.SESSION_MAX_IDLE || 3600),
  BOT_TOKEN: process.env.BOT_TOKEN || '8450757648:AAEk_lxB5x8-vGGueYhM6vAATAhMYaNVa1g',
};
