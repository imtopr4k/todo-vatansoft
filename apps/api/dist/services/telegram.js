"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReply = sendReply;
exports.sendMessage = sendMessage;
exports.sendDM = sendDM;
exports.setMessageReaction = setMessageReaction;
const env_1 = require("../env");
const node_fetch_1 = __importDefault(require("node-fetch"));
function baseUrl() {
    if (!env_1.env.BOT_TOKEN)
        throw new Error('BOT_TOKEN missing in API env');
    return `https://api.telegram.org/bot${env_1.env.BOT_TOKEN}`;
}
async function sendReply(chatId, replyToMessageId, text) {
    const res = await (0, node_fetch_1.default)(`${baseUrl()}/sendMessage`, {
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
async function sendMessage(chatId, text) {
    const res = await (0, node_fetch_1.default)(`${baseUrl()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
    }
}
async function sendDM(userId, text) {
    return sendMessage(userId, text);
}
async function setMessageReaction(chatId, messageId, emoji = '👍') {
    const res = await (0, node_fetch_1.default)(`${baseUrl()}/setMessageReaction`, {
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
