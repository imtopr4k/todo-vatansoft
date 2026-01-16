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
        status: 'open',
        history: [{
                at: new Date(),
                action: 'created',
                note: `Görev oluşturuldu ve ${chosen.name}'e atandı`
            }]
    });
    // Kısa ID hesapla (son 6 karakter)
    const shortId = String(t._id).slice(-6).toUpperCase();
    // Gruba sadece bilgilendirme mesajı gönder (buton YOK)
    await (0, telegram_1.sendReply)(chatId, messageId, `#${shortId} - Görev ${chosen.name}'e atandı.`);
    // Atanan kişiye özelden DM gönder
    try {
        const assignedAgent = await Agent_1.Agent.findById(chosen.id).lean();
        if (assignedAgent?.telegramUserId) {
            const senderName = from?.displayName || from?.firstName || from?.username || 'Bilinmiyor';
            const dmMessage = `🆕 Yeni Görev Atandı!\n\n📋 Görev ID: #${shortId}\n👤 Gönderen: ${senderName}\n\n💬 Mesaj:\n${text || '(Mesaj içeriği yok)'}\n\n📌 Lütfen en kısa sürede ilgilenin.`;
            await (0, telegram_1.sendDM)(assignedAgent.telegramUserId, dmMessage);
            console.log(`[bot] DM sent to assigned agent ${chosen.name} (${assignedAgent.telegramUserId})`);
        }
        else {
            console.log(`[bot] Agent ${chosen.name} has no telegramUserId, skipping DM`);
        }
    }
    catch (dmErr) {
        console.error('[bot] Failed to send DM to assigned agent:', dmErr);
    }
    // Real-time bildirim gönder
    try {
        const io = global.io;
        if (io) {
            io.emit('new_ticket', {
                ticketId: String(t._id),
                assignedTo: chosen.id,
                assignedToName: chosen.name,
                text: text,
                from: from?.displayName || 'Bilinmiyor',
                isUrgent: false,
                status: 'open',
                createdAt: new Date().toISOString()
            });
            console.log('[socket] Emitted new_ticket:', String(t._id));
        }
    }
    catch (err) {
        console.error('[socket] Failed to emit new_ticket:', err);
    }
    // Kullanıcıya özelden acil butonu gönder
    if (from?.id) {
        try {
            const userMessage = `📋 Talebiniz alındı ve ${chosen.name}'e atandı.\n\nEğer bu talep acilse, aşağıdaki butona tıklayarak işaretleyebilirsiniz:`;
            await (0, telegram_1.sendDM)(from.id, userMessage, [
                [{ text: '🔴 Acil mi?', callback_data: `urgent:${String(t._id)}` }]
            ]);
        }
        catch (err) {
            console.error('[bot] Failed to send urgent button to user:', err);
        }
    }
    res.json({ ticketId: String(t._id) });
});
r.post('/tickets/:ticketId/mark-urgent', async (req, res) => {
    const { ticketId } = req.params;
    console.log('[API] mark-urgent called for ticket:', ticketId);
    const t = await Ticket_1.Ticket.findById(ticketId);
    if (!t) {
        console.log('[API] Ticket not found:', ticketId);
        return res.status(404).json({ message: 'Ticket bulunamadı' });
    }
    console.log('[API] Before update - isUrgent:', t.isUrgent);
    t.isUrgent = true;
    await t.save();
    console.log('[API] After update - isUrgent:', t.isUrgent);
    return res.json({ ok: true });
});
r.post('/ping', (req, res) => {
    console.log('[API] Ping received');
    return res.json({ pong: true, timestamp: Date.now() });
});
exports.default = r;
