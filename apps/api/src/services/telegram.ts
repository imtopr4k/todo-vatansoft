import { env } from '../env';
import fetch from 'node-fetch';

function baseUrl() {
  if (!env.BOT_TOKEN) throw new Error('BOT_TOKEN missing in API env');
  return `https://api.telegram.org/bot${env.BOT_TOKEN}`;
}

export async function sendReply(chatId: number, replyToMessageId: number, text: string) {
  const res = await fetch(`${baseUrl()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
      allow_sending_without_reply: true
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendReply failed: ${res.status} ${body}`);
  }
}

export async function sendMessage(chatId: number, text: string) {
  const res = await fetch(`${baseUrl()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }
}

export async function sendDM(userId: number, text: string) {
  return sendMessage(userId, text);
}
