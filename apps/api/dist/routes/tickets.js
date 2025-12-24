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
const auth_1 = require("../middlewares/auth");
const Ticket_1 = require("../models/Ticket");
const Agent_1 = require("../models/Agent");
const mongoose_1 = require("mongoose");
const telegram_1 = require("../services/telegram");
const r = (0, express_1.Router)();
r.use(auth_1.requireAuth);
// Tek ticket detayı
r.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const ticket = await Ticket_1.Ticket.findById(id)
            .populate('assignedTo', 'name externalUserId isActive')
            .lean();
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        // Sadece kendi ticket'ını veya supervisor tüm ticket'ları görebilir
        if (auth.role !== 'supervisor' && String(ticket.assignedTo?._id || ticket.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        const result = {
            id: String(ticket._id),
            status: ticket.status,
            telegram: ticket.telegram,
            assignedTo: ticket.assignedTo && typeof ticket.assignedTo === 'object'
                ? ticket.assignedTo.name
                : String(ticket.assignedTo),
            assignedAt: ticket.assignedAt || ticket.createdAt,
            resolutionText: ticket.resolutionText,
            interestedBy: ticket.interestedBy ? String(ticket.interestedBy) : undefined,
            interestedAt: ticket.interestedAt,
            updatedAt: ticket.updatedAt,
            createdAt: ticket.createdAt
        };
        return res.json(result);
    }
    catch (err) {
        console.error('[API] Error fetching ticket:', err);
        return res.status(500).json({ message: 'Internal error' });
    }
});
r.get('/', async (req, res) => {
    try {
        const auth = req.auth;
        let { assignedTo, status, q, page, limit, sort } = req.query;
        assignedTo = (assignedTo === 'me' || assignedTo === 'all')
            ? assignedTo
            : (auth.role === 'supervisor' ? 'all' : 'me');
        page = Number.isFinite(+page) && +page > 0 ? Math.floor(+page) : 1;
        limit = Number.isFinite(+limit) && +limit > 0 ? Math.min(100, Math.floor(+limit)) : 10;
        sort = sort === 'oldest' ? 'oldest' : 'newest';
        if (status && !['open', 'resolved', 'unreachable', 'reported', 'waiting'].includes(String(status))) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        const query = {};
        if (status)
            query.status = status;
        if (auth.role === 'agent' || assignedTo === 'me') {
            query.assignedTo = auth.sub;
        }
        if (q && String(q).trim()) {
            const term = String(q).trim();
            const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [
                { 'telegram.text': rx },
                { 'telegram.from.displayName': rx },
                { 'telegram.from.username': rx },
                { resolutionText: rx },
            ];
        }
        const skip = (page - 1) * limit;
        const [total, list] = await Promise.all([
            Ticket_1.Ticket.countDocuments(query),
            Ticket_1.Ticket.find(query)
                .populate('assignedTo', 'name externalUserId isActive') // 🔎 populate
                .sort(sort === 'newest' ? { assignedAt: -1, _id: -1 } : { assignedAt: 1, _id: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);
        const items = list.map(t => ({
            id: String(t._id),
            status: t.status,
            telegram: t.telegram,
            assignedTo: t.assignedTo && typeof t.assignedTo === 'object'
                ? {
                    id: String(t.assignedTo._id),
                    name: t.assignedTo.name,
                    externalUserId: String(t.assignedTo.externalUserId),
                    isActive: !!t.assignedTo.isActive
                }
                : (t.assignedTo ? String(t.assignedTo) : undefined),
            assignedAt: t.assignedAt || t.createdAt,
            resolutionText: t.resolutionText,
            interestedBy: t.interestedBy ? String(t.interestedBy) : undefined,
            interestedAt: t.interestedAt,
            updatedAt: t.updatedAt,
        }));
        return res.json({
            items, page, limit, total,
            pages: Math.max(1, Math.ceil(total / limit)),
        });
    }
    catch (err) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
r.post('/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionText } = req.body;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        const msg = String((resolutionText ?? '')).trim();
        const prevStatus = t.status;
        t.status = 'resolved';
        t.resolutionText = msg;
        await t.save();
        try {
            // If transitioning from unreachable or reported -> resolved, show transition
            let signature = statusLabel(t.status);
            if (prevStatus && (prevStatus === 'unreachable' || prevStatus === 'reported')) {
                signature = `${statusLabel(prevStatus)} => ${statusLabel(t.status)}`;
            }
            const final = `${msg || 'Çözümlendi'}${signature ? '\n\n-' + signature : ''}`;
            // Gruba yanıt gönder
            await (0, telegram_1.sendReply)(t.telegram.chatId, t.telegram.messageId, final);
            // Kullanıcıya özel mesaj gönder
            if (t.telegram?.from?.id) {
                const userMessage = `✅ Talebiniz çözümlendi!\n\n📝 Detay: ${msg || 'Sorun giderildi.'}\n\nℹ️ Herhangi bir sorunuz varsa bizimle iletişime geçebilirsiniz.`;
                await (0, telegram_1.sendDM)(t.telegram.from.id, userMessage);
            }
        }
        catch (e) {
        }
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ message: 'Internal error' });
    }
});
// POST /tickets/:id/report
// Mark ticket as reported (Yazılıma iletildi). Does not send group notification by default.
r.post('/:id/report', async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionText } = req.body;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        const msg = String((resolutionText ?? '')).trim();
        t.status = 'reported';
        t.resolutionText = msg;
        await t.save();
        // Send a group reply to the original telegram message to notify that it was reported
        try {
            if (t.telegram?.chatId && t.telegram?.messageId) {
                const label = statusLabel(t.status);
                const final = `${msg || 'Konu yazılıma iletilmiştir'}${label ? '\n\n-' + label : ''}`;
                // Gruba yanıt gönder
                await (0, telegram_1.sendReply)(t.telegram.chatId, t.telegram.messageId, final);
                // Kullanıcıya özel mesaj gönder
                if (t.telegram?.from?.id) {
                    const userMessage = `📤 Talebiniz yazılım ekibine iletildi.\n\n📝 Detay: ${msg || 'Konunuz yazılım departmanına yönlendirildi.'}\n\n⏳ En kısa sürede dönüş sağlanacaktır.`;
                    await (0, telegram_1.sendDM)(t.telegram.from.id, userMessage);
                }
            }
        }
        catch (e) {
        }
        return res.json({ ok: true });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
// GET /tickets/stats/senders
// Return counts grouped by telegram sender (displayName / username / id)
r.get('/stats/senders', async (req, res) => {
    try {
        // Tarih filtresi
        const { from, to } = req.query;
        const query = {};
        if (from) {
            const d = new Date(from);
            if (!isNaN(d.getTime()))
                query.createdAt = { ...(query.createdAt || {}), $gte: d };
        }
        if (to) {
            const d = new Date(to);
            if (!isNaN(d.getTime()))
                query.createdAt = { ...(query.createdAt || {}), $lte: d };
        }
        // We will aggregate in JS to be tolerant to missing fields and keep logic simple
        const list = await Ticket_1.Ticket.find(query).select('telegram.from telegram.text createdAt').lean();
        function extractProject(text) {
            if (!text)
                return null;
            const lines = String(text).split(/\r?\n/);
            for (const line of lines) {
                const m = line.match(/\bproje\s*[\.:：\-]?\s*(.+)$/i);
                if (m && m[1])
                    return m[1].trim();
            }
            // try english fallback
            const m2 = String(text).match(/\bproject\s*[\.:：\-]?\s*(.+)$/i);
            if (m2 && m2[1])
                return m2[1].trim();
            return null;
        }
        function normalizeProjKey(s) {
            return String(s || '')
                .trim()
                .toLocaleLowerCase('tr-TR')
                .replace(/[\s]+/g, ' ')
                .replace(/["'`·•••\*\(\)\[\]{}<>]/g, '')
                .normalize('NFKD')
                .replace(/\p{Diacritic}/gu, '');
        }
        const map = new Map();
        for (const t of list) {
            const from = t.telegram?.from || {};
            const id = from.id ?? from.telegramUserId ?? null;
            const name = from.displayName || [from.firstName, from.lastName].filter(Boolean).join(' ').trim() || from.username || (id ? String(id) : 'Bilinmiyor');
            const key = id ? `id:${id}` : `name:${name}`;
            const prev = map.get(key);
            if (prev)
                prev.count += 1;
            else
                map.set(key, { name, id: id ?? undefined, count: 1, projects: {} });
            // project extraction
            const proj = extractProject(t.telegram?.text);
            if (proj) {
                const entry = map.get(key);
                entry.projects = entry.projects || {};
                const norm = normalizeProjKey(proj);
                if (!entry.projects[norm])
                    entry.projects[norm] = { count: 0, variants: {} };
                entry.projects[norm].count = (entry.projects[norm].count || 0) + 1;
                entry.projects[norm].variants[proj] = (entry.projects[norm].variants[proj] || 0) + 1;
            }
        }
        const out = Array.from(map.values()).map(v => {
            let projects = v.projects || {};
            // Merge variants where a normalized key contains a shorter key
            // e.g. 'salon' and 'salon randevuda' -> group under 'salon'
            const keys = Object.keys(projects || {});
            const merged = {};
            const used = new Set();
            keys.sort((a, b) => a.length - b.length); // prefer shortest base
            for (const k of keys) {
                if (used.has(k))
                    continue;
                merged[k] = { ...projects[k] };
                // ensure shape
                merged[k].count = merged[k].count || 0;
                merged[k].variants = merged[k].variants || {};
                for (const kk of keys) {
                    if (kk === k || used.has(kk))
                        continue;
                    // if kk contains k (longer phrase containing the shorter base), merge kk into k
                    if (kk.includes(k)) {
                        merged[k].count = (merged[k].count || 0) + (projects[kk].count || 0);
                        merged[k].variants = { ...(merged[k].variants || {}), ...(projects[kk].variants || {}) };
                        used.add(kk);
                    }
                }
            }
            // build top list from merged
            const top = Object.keys(merged).map(k => {
                const p = merged[k];
                const variants = p.variants || {};
                const varKeys = Object.keys(variants);
                let display = k;
                if (varKeys.length) {
                    varKeys.sort((a, b) => (variants[b] || 0) - (variants[a] || 0));
                    display = varKeys[0];
                }
                display = String(display).trim();
                if (display.length)
                    display = display[0].toUpperCase() + display.slice(1);
                return { name: display, count: p.count };
            }).sort((a, b) => b.count - a.count).slice(0, 3);
            return { name: v.name, id: v.id, count: v.count, topProjects: top };
        }).sort((a, b) => b.count - a.count);
        return res.json(out);
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
// GET /tickets/stats/agents
// Return counts grouped by assigned agent: total, resolved, unreachable, open, reported
r.get('/stats/agents', async (req, res) => {
    try {
        // Tarih filtresi
        const { from, to } = req.query;
        const query = {};
        if (from) {
            const d = new Date(from);
            if (!isNaN(d.getTime()))
                query.createdAt = { ...(query.createdAt || {}), $gte: d };
        }
        if (to) {
            const d = new Date(to);
            if (!isNaN(d.getTime()))
                query.createdAt = { ...(query.createdAt || {}), $lte: d };
        }
        const list = await Ticket_1.Ticket.find(query).select('assignedTo status createdAt').populate('assignedTo', 'name externalUserId').lean();
        const map = new Map();
        for (const t of list) {
            const aid = t.assignedTo && typeof t.assignedTo === 'object' ? String(t.assignedTo._id) : String(t.assignedTo || 'unassigned');
            const name = t.assignedTo && typeof t.assignedTo === 'object' ? t.assignedTo.name : 'Atanmamış';
            const ext = t.assignedTo && typeof t.assignedTo === 'object' ? String(t.assignedTo.externalUserId) : undefined;
            const prev = map.get(aid);
            if (!prev) {
                map.set(aid, { id: aid, name, externalUserId: ext, total: 0, open: 0, resolved: 0, unreachable: 0, reported: 0 });
            }
            const cur = map.get(aid);
            cur.total += 1;
            const s = String(t.status || 'open');
            if (s === 'open')
                cur.open += 1;
            else if (s === 'resolved')
                cur.resolved += 1;
            else if (s === 'unreachable')
                cur.unreachable += 1;
            else if (s === 'reported')
                cur.reported += 1;
        }
        const out = Array.from(map.values()).sort((a, b) => b.total - a.total);
        return res.json(out);
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
function statusLabel(key) {
    switch (String(key || '').toLowerCase()) {
        case 'resolved': return 'Çözümlendi';
        case 'reported': return 'Yazılıma iletildi';
        case 'unreachable': return 'Ulaşılamadı';
        case 'open': return 'Açık';
        case 'assigned': return 'Atandı';
        case 'waiting': return 'Üye Bekleniyor';
        default: return String(key || '').length ? String(key) : '';
    }
}
// PUT /tickets/:id
// Generic update endpoint used as a fallback by the UI to set status/resolutionText
r.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolutionText } = req.body;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        // Only allow updating a restricted set of fields
        if (typeof status !== 'undefined') {
            if (!['open', 'resolved', 'unreachable', 'reported', 'waiting'].includes(String(status))) {
                return res.status(400).json({ message: 'Invalid status' });
            }
            t.status = String(status);
        }
        if (typeof resolutionText !== 'undefined') {
            t.resolutionText = String(resolutionText ?? '');
        }
        await t.save();
        return res.json({ ok: true });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
r.post('/:id/unreachable', async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionText, scheduleDateTime } = req.body;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        const msg = String((resolutionText ?? '')).trim();
        t.status = 'unreachable';
        t.resolutionText = msg;
        // Grup mesajını hemen gönder
        try {
            if (t.telegram?.chatId && t.telegram?.messageId) {
                const actor = await Agent_1.Agent.findById(auth.sub).lean();
                const actorName = actor?.name || '';
                const label = statusLabel(t.status);
                const final = `${msg || 'wp üzerinden iletişime geçildi'}${label ? '\n\n-' + label : ''}`;
                // Gruba yanıt gönder
                await (0, telegram_1.sendReply)(t.telegram.chatId, t.telegram.messageId, final);
                // Kullanıcıya özel mesaj gönder
                if (t.telegram?.from?.id) {
                    const userMessage = `📞 Size ulaşmaya çalıştık ancak ulaşamadık.\n\n📝 Not: ${msg || 'WhatsApp üzerinden iletişime geçtik.'}\n\n📱 Lütfen iletişim bilgilerinizi kontrol edin.`;
                    await (0, telegram_1.sendDM)(t.telegram.from.id, userMessage);
                }
            }
        }
        catch (e) {
        }
        // Eğer zamanlama varsa, parse et ve eğer geçmişe tarihlendiyse DM'i hemen gönder,
        // gelecekte bir tarihse scheduledDMAt olarak kaydet
        let scheduledDate = null;
        if (scheduleDateTime) {
            const parsed = new Date(scheduleDateTime);
            if (!isNaN(parsed.getTime())) {
                scheduledDate = parsed;
            }
            else {
            }
        }
        if (scheduledDate && scheduledDate.getTime() > Date.now()) {
            // future date -> persist and scheduler will pick it up
            t.scheduledDMAt = scheduledDate;
            await t.save();
        }
        else {
            // no schedule or schedule in past/invalid -> don't persist scheduledDMAt and send DM now
            t.scheduledDMAt = undefined;
            await t.save();
            try {
                const actor = await Agent_1.Agent.findById(auth.sub);
                if (actor?.telegramUserId && t.telegram?.text) {
                    const note = `Lütfen ${t.telegram.text} konusu ile ilgili müşteri ile iletişime geç.`;
                    const label = statusLabel(t.status);
                    const final = `${note}${label ? '\n\n-' + t.telegram?.from?.displayName : ''}`;
                    await (0, telegram_1.sendDM)(actor.telegramUserId, final);
                }
            }
            catch (e) {
            }
        }
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ message: 'Internal error' });
    }
});
// POST /tickets/:id/analyze
// Save difficulty + optional note for a ticket (agent analysis)
r.post('/:id/analyze', async (req, res) => {
    try {
        const { id } = req.params;
        const { difficulty, note } = req.body;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        const entry = { at: new Date(), byAgentId: auth.sub };
        if (difficulty && ['easy', 'medium', 'hard'].includes(String(difficulty)))
            entry.difficulty = String(difficulty);
        if (typeof note !== 'undefined')
            entry.note = String(note || '');
        t.analysis = t.analysis || [];
        t.analysis.push(entry);
        await t.save();
        return res.json({ ok: true });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
// GET /tickets/analysis
// Query tickets within a date range and optionally by agent; returns ticket list with analysis
r.get('/analysis', async (req, res) => {
    try {
        const { from, to, agentId } = req.query;
        const q = {};
        if (from) {
            const d = new Date(from);
            if (!isNaN(d.getTime()))
                q.createdAt = { ...(q.createdAt || {}), $gte: d };
        }
        if (to) {
            const d = new Date(to);
            if (!isNaN(d.getTime()))
                q.createdAt = { ...(q.createdAt || {}), $lte: d };
        }
        if (agentId)
            q.assignedTo = agentId;
        const list = await Ticket_1.Ticket.find(q)
            .select('telegram assignedTo status createdAt analysis resolutionText')
            .populate('assignedTo', 'name externalUserId')
            .lean();
        const out = list.map((t) => ({
            id: String(t._id),
            createdAt: t.createdAt,
            status: t.status,
            telegram: t.telegram,
            assignedTo: t.assignedTo && typeof t.assignedTo === 'object' ? { id: String(t.assignedTo._id), name: t.assignedTo.name, externalUserId: String(t.assignedTo.externalUserId) } : t.assignedTo,
            analysis: t.analysis || [],
            resolutionText: t.resolutionText
        }));
        return res.json(out);
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
r.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role === 'supervisor') {
            await t.deleteOne();
            return res.json({ ok: true });
        }
        return res.status(403).json({ message: 'Forbidden' });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
r.put('/:id/assign', async (req, res) => {
    try {
        const { id } = req.params;
        const { toAgentId } = req.body;
        const auth = req.auth;
        if (!toAgentId)
            return res.status(400).json({ message: 'toAgentId zorunlu' });
        // Bilet ve ajanlar
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Ticket bulunamadı' });
        // Atama izni kontrolü
        const requester = await Agent_1.Agent.findById(auth.sub).lean();
        const isSuperAgent = auth.role === 'supervisor' || ['1', '1009'].includes(String(requester?.externalUserId));
        // Eğer süper ajan değilse, sadece kendisine atanmış görevleri yeniden atayabilir
        if (!isSuperAgent && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Bu görevi yeniden atama yetkiniz yok' });
        }
        const fromAgent = t.assignedTo ? await Agent_1.Agent.findById(t.assignedTo).lean() : null;
        // toAgentId may be either Mongo _id or an externalUserId — try both
        let toAgent = null;
        let usedFallback = false;
        let matchedBy = null;
        try {
            if (mongoose_1.Types.ObjectId.isValid(String(toAgentId))) {
                toAgent = await Agent_1.Agent.findById(toAgentId).lean();
                if (toAgent)
                    matchedBy = 'id';
            }
            else {
            }
        }
        catch (e) {
        }
        if (!toAgent) {
            toAgent = await Agent_1.Agent.findOne({ externalUserId: String(toAgentId) }).lean();
            if (toAgent)
                matchedBy = 'externalUserId';
            if (toAgent)
                usedFallback = true;
        }
        if (!toAgent) {
            return res.status(400).json({ message: 'Hedef agent bulunamadı' });
        }
        // Business rule: never allow assigning to externalUserId '1'
        if (String(toAgent.externalUserId) === '1') {
            return res.status(400).json({ message: 'Bu kullanıcıya atama yapılamaz' });
        }
        // Güncelle
        t.assignedTo = toAgent._id;
        t.assignedAt = new Date();
        // push history
        t.history = t.history || [];
        t.history.push({ at: new Date(), byAgentId: requester?._id, action: 'reassign', note: `from ${String(fromAgent?._id || '—')} to ${String(toAgent._id)}` });
        await t.save();
        // Telegram’a bildir (orijinal mesaja reply)
        const fromName = fromAgent?.name || '—';
        const toName = toAgent.name || '—';
        const notifyBase = `Görev el değiştirdi\n${fromName} => ${toName}`;
        try {
            if (t.telegram?.chatId && t.telegram?.messageId) {
                const label = statusLabel('assigned');
                const notify = `${notifyBase}${label ? '\n\n-' + label : ''}`;
                await (0, telegram_1.sendReply)(t.telegram.chatId, t.telegram.messageId, notify);
            }
        }
        catch (e) {
            // Bildirim düşmese de atama başarılıdır; 200 döndürmeye devam ediyoruz.
        }
        return res.json({ ok: true, assignedTo: { id: String(toAgent._id), name: toAgent.name }, matchedBy });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
// POST /tickets/:id/notify
// Send a plain reply message to the ticket chat without changing ticket state.
r.post('/:id/notify', async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        const msg = String((message ?? '')).trim() || 'Konu yazılıma iletilmiştir';
        try {
            if (t.telegram?.chatId && t.telegram?.messageId) {
                const label = statusLabel(t.status);
                const actor = await Agent_1.Agent.findById(auth.sub).lean();
                const actorName = actor?.name || '';
                const final = `${msg}${label ? '\n\n-' + label : ''}`;
                await (0, telegram_1.sendReply)(t.telegram.chatId, t.telegram.messageId, final);
            }
        }
        catch (e) {
            return res.status(500).json({ message: 'Send failed' });
        }
        return res.json({ ok: true });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
// POST /tickets/:id/interested
// Mark ticket as interested (ilgileniyorum)
r.post('/:id/interested', async (req, res) => {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        t.interestedBy = auth.sub;
        t.interestedAt = new Date();
        await t.save();
        // Telegram mesajına reaction (like) ekle
        try {
            if (t.telegram?.chatId && t.telegram?.messageId) {
                const { setMessageReaction } = await Promise.resolve().then(() => __importStar(require('../services/telegram')));
                await setMessageReaction(t.telegram.chatId, t.telegram.messageId, '👍');
            }
        }
        catch (e) {
            // Reaction eklenemese bile işlem başarılı sayılır
            console.error('Failed to add reaction:', e);
        }
        return res.json({ ok: true });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
// POST /tickets/:id/notify-sender
// Send a private DM to the original telegram sender (do NOT reply in group)
r.post('/:id/notify-sender', async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        const from = t.telegram?.from || {};
        const userId = from.id || from.telegramUserId || null;
        if (!userId)
            return res.status(400).json({ message: 'No sender id available' });
        const baseMsg = String((message ?? '').trim()) || 'Mesajınız hatalı, iletişim alanı zorunludur.';
        const original = t.telegram?.text || '(orijinal mesaj yok)';
        const actor = await Agent_1.Agent.findById(auth.sub).lean();
        const actorName = actor?.name || '';
        const text = `${baseMsg}\n\nOrijinal mesaj:\n${original}`;
        try {
            await (0, telegram_1.sendDM)(Number(userId), text);
        }
        catch (e) {
            return res.status(500).json({ message: 'Send failed' });
        }
        return res.json({ ok: true });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
// POST /tickets/:id/waiting
// Mark ticket as waiting and send DM to user
r.post('/:id/waiting', async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const auth = req.auth;
        const t = await Ticket_1.Ticket.findById(id);
        if (!t)
            return res.status(404).json({ message: 'Not found' });
        if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
            return res.status(403).json({ message: 'Not your ticket' });
        }
        // Durumu 'waiting' olarak işaretle
        t.status = 'waiting';
        await t.save();
        // Kullanıcıya DM gönder
        const from = t.telegram?.from || {};
        const userId = from.id || from.telegramUserId || null;
        if (userId) {
            const baseMsg = String((message ?? '').trim()) || 'Lütfen eksik bilgileri tamamlayınız.';
            const original = t.telegram?.text || '(orijinal mesaj yok)';
            const text = `${baseMsg}\n\nOrijinal mesaj:\n${original}`;
            try {
                await (0, telegram_1.sendDM)(Number(userId), text);
            }
            catch (e) {
                console.error('Failed to send DM:', e);
            }
        }
        // Gruba da bildirim gönder
        try {
            if (t.telegram?.chatId && t.telegram?.messageId) {
                const label = statusLabel('waiting');
                const finalMsg = String((message ?? '').trim()) || 'Üye bekleniyor';
                const final = `${finalMsg}${label ? '\n\n-' + label : ''}`;
                await (0, telegram_1.sendReply)(t.telegram.chatId, t.telegram.messageId, final);
            }
        }
        catch (e) {
            console.error('Failed to send group reply:', e);
        }
        return res.json({ ok: true });
    }
    catch (e) {
        return res.status(500).json({ message: 'Internal error' });
    }
});
exports.default = r;
