"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Ticket_1 = require("../models/Ticket");
const assigner_1 = require("../services/assigner");
const telegram_1 = require("../services/telegram");
const Agent_1 = require("../models/Agent");
const r = (0, express_1.Router)();
r.post('/link', async (req, res) => {
    const { agentId, telegramUserId } = req.body;
    if (!agentId || !telegramUserId) {
        return res.status(400).json({ message: 'agentId ve telegramUserId zorunlu' });
    }
    const a = await Agent_1.Agent.findById(agentId);
    if (!a)
        return res.status(404).json({ message: 'Agent bulunamadı' });
    a.telegramUserId = Number(telegramUserId);
    await a.save();
    return res.json({ ok: true });
});
r.post('/intake', async (req, res) => {
    const { chatId, messageId, text, from } = req.body;
    let chosen;
    try {
        chosen = await (0, assigner_1.assignAgentForMessage)(text);
    }
    catch (e) {
        if (e.message === 'NO_ACTIVE_AGENT') {
            // No active agent: create a ticket without assignedTo and keep it pending.
            const t = await Ticket_1.Ticket.create({
                source: 'telegram',
                telegram: {
                    chatId, messageId, text,
                    from: from ? {
                        id: from.id,
                        username: from.username,
                        firstName: from.firstName,
                        lastName: from.lastName,
                        displayName: from.displayName
                    } : undefined
                },
                status: 'open'
            });
            try {
                await (0, telegram_1.sendReply)(chatId, messageId, 'Atanacak aktif agent bulunamadı; mesaj sıraya alındı. En kısa sürede atanacaktır.');
            }
            catch (ex) {
            }
            return res.status(200).json({ ticketId: String(t._id), pending: true });
        }
        throw e;
    }
    const t = await Ticket_1.Ticket.create({
        source: 'telegram',
        telegram: {
            chatId, messageId, text,
            from: from ? {
                id: from.id,
                username: from.username,
                firstName: from.firstName,
                lastName: from.lastName,
                displayName: from.displayName
            } : undefined
        },
        assignedTo: chosen.id,
        assignedAt: new Date(),
        status: 'open'
    });
    await (0, telegram_1.sendReply)(chatId, messageId, `Görev ${chosen.name}'e atandı.`);
    res.json({ ticketId: String(t._id) });
});
r.post('/ping', (req, res) => {
    console.log('[API] Ping received');
    return res.json({ pong: true, timestamp: Date.now() });
});
exports.default = r;
