"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Agent_1 = require("../models/Agent");
const jwt_1 = require("../services/jwt");
const auth_1 = require("../middlewares/auth");
const r = (0, express_1.Router)();
// externalUserId + password ile giriş
r.post('/login', async (req, res) => {
    let { externalUserId, password } = req.body;
    if (!externalUserId || !password)
        return res.status(400).json({ message: 'externalUserId ve password zorunludur' });
    externalUserId = String(externalUserId).trim();
    const orQuery = [{ externalUserId }];
    const asNum = Number(externalUserId);
    if (!Number.isNaN(asNum))
        orQuery.push({ externalUserId: String(asNum) });
    const agent = await Agent_1.Agent.findOne({ $or: orQuery });
    if (!agent)
        return res.status(400).json({ message: 'User Id de sorun var' });
    // Şifre kontrolü (geçiş dönemi için düz metne izin – sonra kaldır)
    let ok = false;
    if (agent.passwordHash) {
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
        ok = await bcrypt.compare(password, agent.passwordHash);
    }
    else if (agent.password) {
        ok = password === agent.password;
    }
    if (!ok)
        return res.status(400).json({ message: 'Şifre hatalı' });
    agent.isActive = true;
    agent.lastActivityAt = new Date();
    await agent.save();
    const accessToken = (0, jwt_1.signAccessToken)({ sub: agent._id.toString(), role: agent.role });
    res.json({
        accessToken,
        agent: {
            id: agent._id,
            role: agent.role,
            name: agent.name,
            externalUserId: agent.externalUserId
        }
    });
});
r.post('/logout', async (req, res) => {
    const { agentId } = req.body;
    await Agent_1.Agent.findByIdAndUpdate(agentId, { isActive: false });
    res.json({ ok: true });
});
// Register endpoint - create new agent
// Register endpoint - create new agent
// NOTE: Disabled for public use. Only privileged agents (externalUserId 1 or 1907) may create users via API.
r.post('/register', auth_1.requireAuth, async (req, res) => {
    try {
        const auth = req.auth;
        if (!auth || !auth.sub)
            return res.status(401).json({ message: 'Unauthorized' });
        const requester = await Agent_1.Agent.findById(auth.sub).lean();
        if (!requester)
            return res.status(403).json({ message: 'Forbidden' });
        // Only supervisors may create new users
        if (String(requester.role) !== 'supervisor') {
            return res.status(403).json({ message: 'Kayıt oluşturma yetkiniz yok' });
        }
        let { name, externalUserId, password, role } = req.body;
        if (!name || !externalUserId || !password)
            return res.status(400).json({ message: 'name, externalUserId ve password zorunludur' });
        name = String(name).trim();
        externalUserId = String(externalUserId).trim();
        password = String(password);
        role = role === 'Temsilci' ? 'supervisor' : 'agent';
        // check existing
        const exists = await Agent_1.Agent.findOne({ externalUserId });
        if (exists)
            return res.status(400).json({ message: 'externalUserId zaten kayıtlı' });
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
        const hash = await bcrypt.hash(password, 10);
        const a = new Agent_1.Agent({ name, externalUserId: String(externalUserId), passwordHash: hash, role });
        await a.save();
        const accessToken = (0, jwt_1.signAccessToken)({ sub: a._id.toString(), role: a.role });
        res.json({ accessToken, agent: { id: a._id, role: a.role, name: a.name } });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
r.post('/heartbeat', async (req, res) => {
    const { agentId } = req.body;
    await Agent_1.Agent.findByIdAndUpdate(agentId, { lastActivityAt: new Date() });
    res.json({ ok: true });
});
exports.default = r;
// Set active/inactive for current agent (requires auth)
r.post('/set-active', auth_1.requireAuth, async (req, res) => {
    try {
        const { isActive } = req.body;
        const auth = req.auth;
        if (!auth || !auth.sub)
            return res.status(401).json({ message: 'Unauthorized' });
        const update = { isActive: !!isActive };
        if (isActive)
            update.lastActivityAt = new Date();
        await Agent_1.Agent.findByIdAndUpdate(auth.sub, update);
        // If agent became active, try to assign oldest pending ticket (assignedTo == null)
        if (isActive) {
            try {
                const agent = await Agent_1.Agent.findById(auth.sub).lean();
                if (agent) {
                    const pending = await (await Promise.resolve().then(() => __importStar(require('../models/Ticket')))).Ticket.findOne({ assignedTo: { $exists: false } }).sort({ createdAt: 1 }).exec();
                    if (pending) {
                        pending.assignedTo = agent._id;
                        pending.assignedAt = new Date();
                        pending.history = pending.history || [];
                        pending.history.push({ at: new Date(), byAgentId: agent._id, action: 'auto-assign-on-active', note: `Assigned when ${agent.name} became active` });
                        await pending.save();
                        // notify group that ticket was assigned
                        try {
                            const { sendReply } = await Promise.resolve().then(() => __importStar(require('../services/telegram')));
                            if (pending.telegram?.chatId && pending.telegram?.messageId) {
                                const label = 'Atandı';
                                const final = `Görev ${agent.name} aktif olduğu için otomatik olarak atandı.${label ? '\n\n-' + label : ''}`;
                                await sendReply(pending.telegram.chatId, pending.telegram.messageId, final);
                            }
                        }
                        catch (e) {
                        }
                    }
                }
            }
            catch (e) {
            }
        }
        return res.json({ ok: true, isActive: !!isActive });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
