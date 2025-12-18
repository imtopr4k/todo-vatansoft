"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicketAndAssign = createTicketAndAssign;
exports.markResolved = markResolved;
exports.markUnreachable = markUnreachable;
exports.registerUserChatId = registerUserChatId;
exports.saveUserReply = saveUserReply;
const node_fetch_1 = __importDefault(require("node-fetch"));
const env_1 = require("./env");
async function createTicketAndAssign(payload) {
    const res = await (0, node_fetch_1.default)(`${env_1.env.API_BASE_URL}/bot/intake`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok)
        throw new Error(await res.text());
    return res.json();
}
async function markResolved(ticketId) {
    await (0, node_fetch_1.default)(`${env_1.env.API_BASE_URL}/bot/tickets/${ticketId}/resolved`, { method: 'POST' });
}
async function markUnreachable(ticketId) {
    await (0, node_fetch_1.default)(`${env_1.env.API_BASE_URL}/bot/tickets/${ticketId}/unreachable`, { method: 'POST' });
}
async function registerUserChatId(payload) {
    const res = await (0, node_fetch_1.default)(`${env_1.env.API_BASE_URL}/chat/register-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok)
        throw new Error(await res.text());
}
async function saveUserReply(payload) {
    // Genel sohbet olarak kaydet (direkt chat)
    const res = await (0, node_fetch_1.default)(`${env_1.env.API_BASE_URL}/chat/direct-user-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok)
        throw new Error(await res.text());
}
