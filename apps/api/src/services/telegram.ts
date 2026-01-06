import { env } from '../env';
import fetch from 'node-fetch';

function baseUrl() {
  if (!env.BOT_TOKEN) throw new Error('BOT_TOKEN missing in API env');
  return `https://api.telegram.org/bot${env.BOT_TOKEN}`;
}

export async function sendReply(
  chatId: number, 
  replyToMessageId: number, 
  text: string,
  inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>
) {
  const body: any = {
    chat_id: chatId,
    text,
    reply_to_message_id: replyToMessageId,
    allow_sending_without_reply: true
  };
  
  if (inlineKeyboard) {
    body.reply_markup = {
      inline_keyboard: inlineKeyboard
    };
  }
  
  const res = await fetch(`${baseUrl()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
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

export async function sendDM(
  userId: number, 
  text: string,
  inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>
) {
  const body: any = {
    chat_id: userId,
    text
  };
  
  if (inlineKeyboard) {
    body.reply_markup = {
      inline_keyboard: inlineKeyboard
    };
  }
  
  const res = await fetch(`${baseUrl()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendDM failed: ${res.status} ${body}`);
  }
}

export async function setMessageReaction(chatId: number, messageId: number, emoji: string = '👍') {
  const res = await fetch(`${baseUrl()}/setMessageReaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji }],
      is_big: false
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram setMessageReaction failed: ${res.status} ${body}`);
  }
}
