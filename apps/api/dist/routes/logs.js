"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const BotLog_1 = require("../models/BotLog");
const Agent_1 = require("../models/Agent");
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
exports.default = r;
