"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const BotLog_1 = require("../models/BotLog");
const Agent_1 = require("../models/Agent");
const Ticket_1 = require("../models/Ticket");
const r = (0, express_1.Router)();
r.use(auth_1.requireAuth);
// GET /logs - Sadece externalUserId 1009 erişebilir
r.get('/', async (req, res) => {
    try {
        const auth = req.auth;
        // Kullanıcıyı kontrol et
        const agent = await Agent_1.Agent.findById(auth.sub).lean();
        if (!agent || String(agent.externalUserId) !== '1009') {
            return res.status(403).json({ message: 'Bu sayfaya erişim yetkiniz yok' });
        }
        let { page, limit, level, event } = req.query;
        page = Number.isFinite(+page) && +page > 0 ? Math.floor(+page) : 1;
        limit = Number.isFinite(+limit) && +limit > 0 ? Math.min(1000, Math.floor(+limit)) : 100;
        const query = {};
        if (level && ['info', 'warn', 'error', 'debug'].includes(String(level))) {
            query.level = level;
        }
        if (event) {
            query.event = new RegExp(String(event).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        }
        const skip = (page - 1) * limit;
        const [total, logs] = await Promise.all([
            BotLog_1.BotLog.countDocuments(query),
            BotLog_1.BotLog.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);
        const items = logs.map(log => ({
            id: String(log._id),
            timestamp: log.timestamp,
            level: log.level,
            event: log.event,
            data: log.data,
            message: log.message,
            chatId: log.chatId,
            messageId: log.messageId,
            fromId: log.fromId,
            isBot: log.isBot
        }));
        return res.json({
            items,
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit))
        });
    }
    catch (e) {
        console.error('Error fetching logs:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// POST /logs - Bot loglarını kaydet (internal API için)
r.post('/', async (req, res) => {
    try {
        const { level, event, data, message, chatId, messageId, fromId, isBot } = req.body;
        const log = new BotLog_1.BotLog({
            level: level || 'info',
            event,
            data,
            message,
            chatId,
            messageId,
            fromId,
            isBot
        });
        await log.save();
        return res.json({ success: true, id: String(log._id) });
    }
    catch (e) {
        console.error('Error saving log:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// GET /logs/tickets - Ticket history logları (1 aylık)
r.get('/tickets', async (req, res) => {
    try {
        const auth = req.auth;
        // Kullanıcıyı kontrol et (sadece 1009)
        const agent = await Agent_1.Agent.findById(auth.sub).lean();
        if (!agent || String(agent.externalUserId) !== '1009') {
            return res.status(403).json({ message: 'Bu sayfaya erişim yetkiniz yok' });
        }
        let { page, limit, action, agentId } = req.query;
        page = Number.isFinite(+page) && +page > 0 ? Math.floor(+page) : 1;
        limit = Number.isFinite(+limit) && +limit > 0 ? Math.min(1000, Math.floor(+limit)) : 100;
        // 1 ay öncesi
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const query = {
            'history.0': { $exists: true }, // En az 1 history kaydı olan
            updatedAt: { $gte: oneMonthAgo } // 1 ay içinde güncellenmiş
        };
        const tickets = await Ticket_1.Ticket.find(query)
            .populate('assignedTo', 'name externalUserId')
            .sort({ updatedAt: -1 })
            .lean();
        // Tüm history kayıtlarını düzleştir ve filtrele
        let allHistory = [];
        for (const ticket of tickets) {
            const shortId = String(ticket._id).slice(-6).toUpperCase();
            const assignedAgent = ticket.assignedTo;
            if (ticket.history && ticket.history.length > 0) {
                for (const h of ticket.history) {
                    // 1 ay kontrolü
                    if (new Date(h.at) < oneMonthAgo)
                        continue;
                    // Action filtresi
                    if (action && h.action !== action)
                        continue;
                    // Agent ID filtresi
                    if (agentId && String(h.byAgentId) !== String(agentId))
                        continue;
                    allHistory.push({
                        ticketId: String(ticket._id),
                        shortId,
                        ticketStatus: ticket.status,
                        assignedToName: assignedAgent?.name || 'Atanmamış',
                        timestamp: h.at,
                        action: h.action,
                        note: h.note,
                        byAgentId: h.byAgentId ? String(h.byAgentId) : undefined,
                        senderName: ticket.telegram?.from?.displayName || ticket.telegram?.from?.username || 'Bilinmiyor'
                    });
                }
            }
        }
        // Zamana göre sırala (en yeni en üstte)
        allHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // Pagination
        const total = allHistory.length;
        const skip = (page - 1) * limit;
        const items = allHistory.slice(skip, skip + limit);
        // Agent isimleri için populate
        const agentIds = [...new Set(items.map(i => i.byAgentId).filter(Boolean))];
        const agents = await Agent_1.Agent.find({ _id: { $in: agentIds } }).select('_id name').lean();
        const agentMap = new Map(agents.map(a => [String(a._id), a.name]));
        // Agent isimlerini ekle
        const itemsWithAgents = items.map(i => ({
            ...i,
            byAgentName: i.byAgentId ? agentMap.get(i.byAgentId) || 'Bilinmiyor' : undefined
        }));
        return res.json({
            items: itemsWithAgents,
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit))
        });
    }
    catch (e) {
        console.error('Error fetching ticket logs:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
exports.default = r;
