"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const Agent_1 = require("../models/Agent");
const r = (0, express_1.Router)();
// 🔎 debug: mount olup olmadığını hızlı test için public ping
r.get('/ping', (_req, res) => res.json({ ok: true, where: 'agents router' }));
// 🔐 tüm /agents/* uçlarını auth ile koru
r.use(auth_1.requireAuth);
/**
 * GET /agents
 * Liste: name, externalUserId, isActive, role, telegramUserId
 */
r.get('/', async (_req, res) => {
    const list = await Agent_1.Agent.find({})
        .select('name externalUserId isActive role telegramUserId')
        .sort({ externalUserId: 1 })
        .lean();
    res.json(list.map(a => ({
        id: String(a._id),
        name: a.name,
        externalUserId: String(a.externalUserId),
        isActive: !!a.isActive,
        role: a.role,
        telegramUserId: a.telegramUserId ? String(a.telegramUserId) : undefined,
    })));
});
exports.default = r; // ⚠️ default export şart
