import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { Ticket } from '../models/Ticket';
import { Agent } from '../models/Agent';
import { Types } from 'mongoose';
import { sendReply, sendDM } from '../services/telegram';

const r = Router();
r.use(requireAuth);

/**
 * GET /tickets
 * Query:
 *  - assignedTo = 'me' | 'all'
 *  - status = 'open'|'resolved'|'unreachable'
 *  - q = string
 *  - page = int
 *  - limit = int
 *  - sort = 'newest' | 'oldest'
 */
r.get('/', async (req, res) => {
  try {
    const auth = (req as any).auth as { sub: string; role: 'agent' | 'supervisor' };

    let { assignedTo, status, q, page, limit, sort } = req.query as any;

    assignedTo = (assignedTo === 'me' || assignedTo === 'all')
      ? assignedTo
      : (auth.role === 'supervisor' ? 'all' : 'me');

    page = Number.isFinite(+page) && +page > 0 ? Math.floor(+page) : 1;
    limit = Number.isFinite(+limit) && +limit > 0 ? Math.min(100, Math.floor(+limit)) : 10;
    sort = sort === 'oldest' ? 'oldest' : 'newest';

    if (status && !['open', 'resolved', 'unreachable', 'reported'].includes(String(status))) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const query: any = {};
    if (status) query.status = status;

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
      Ticket.countDocuments(query),
      Ticket.find(query)
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
          id: String((t.assignedTo as any)._id),
          name: (t.assignedTo as any).name,
          externalUserId: String((t.assignedTo as any).externalUserId),
          isActive: !!(t.assignedTo as any).isActive
        }
        : (t.assignedTo ? String(t.assignedTo) : undefined),
      assignedAt: t.assignedAt || t.createdAt,
      resolutionText: t.resolutionText,
    }));

    return res.json({
      items, page, limit, total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('[GET /tickets] error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

r.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionText } = req.body as { resolutionText: any };
    const auth = (req as any).auth;

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
      return res.status(403).json({ message: 'Not your ticket' });
    }

    const msg = String((resolutionText ?? '')).trim();
    t.status = 'resolved';
    t.resolutionText = msg;
    await t.save();

    try {
      await sendReply(t.telegram.chatId, t.telegram.messageId, msg || 'Çözümlendi');
    } catch (e) {
      console.error('[tickets:resolve] send failed', e);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[POST /tickets/:id/resolve]', e);
    res.status(500).json({ message: 'Internal error' });
  }
});

// POST /tickets/:id/report
// Mark ticket as reported (Yazılıma iletildi). Does not send group notification by default.
r.post('/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionText } = req.body as { resolutionText?: any };
    const auth = (req as any).auth;

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
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
        await sendReply(t.telegram.chatId, t.telegram.messageId, msg || 'Konu yazılıma iletilmiştir');
      }
    } catch (e) {
      console.error('[tickets:report] group send failed', e);
      // don't fail the request because the main goal (mark as reported) succeeded
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[POST /tickets/:id/report]', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// GET /tickets/stats/senders
// Return counts grouped by telegram sender (displayName / username / id)
r.get('/stats/senders', async (req, res) => {
  try {
    // We will aggregate in JS to be tolerant to missing fields and keep logic simple
    const list = await Ticket.find({}).select('telegram.from').lean();

    const map = new Map<string, { name: string; id?: number | string; count: number }>();

    for (const t of list) {
      const from = (t as any).telegram?.from || {};
      const id = from.id ?? from.telegramUserId ?? null;
      const name = from.displayName || [from.firstName, from.lastName].filter(Boolean).join(' ').trim() || from.username || (id ? String(id) : 'Bilinmiyor');
      const key = id ? `id:${id}` : `name:${name}`;
      const prev = map.get(key);
      if (prev) prev.count += 1;
      else map.set(key, { name, id: id ?? undefined, count: 1 });
    }

    const out = Array.from(map.values()).sort((a, b) => b.count - a.count);

    return res.json(out);
  } catch (e) {
    console.error('[GET /tickets/stats/senders]', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// GET /tickets/stats/agents
// Return counts grouped by assigned agent: total, resolved, unreachable, open, reported
r.get('/stats/agents', async (req, res) => {
  try {
    const list = await Ticket.find({}).select('assignedTo status').populate('assignedTo', 'name externalUserId').lean();

    const map = new Map<string, { id: string; name: string; externalUserId?: string; total: number; open: number; resolved: number; unreachable: number; reported: number }>();

    for (const t of list) {
      const aid = t.assignedTo && typeof t.assignedTo === 'object' ? String((t.assignedTo as any)._id) : String(t.assignedTo || 'unassigned');
      const name = t.assignedTo && typeof t.assignedTo === 'object' ? (t.assignedTo as any).name : 'Atanmamış';
      const ext = t.assignedTo && typeof t.assignedTo === 'object' ? String((t.assignedTo as any).externalUserId) : undefined;
      const prev = map.get(aid);
      if (!prev) {
        map.set(aid, { id: aid, name, externalUserId: ext, total: 0, open: 0, resolved: 0, unreachable: 0, reported: 0 });
      }
      const cur = map.get(aid)!;
      cur.total += 1;
      const s = String(t.status || 'open');
      if (s === 'open') cur.open += 1;
      else if (s === 'resolved') cur.resolved += 1;
      else if (s === 'unreachable') cur.unreachable += 1;
      else if (s === 'reported') cur.reported += 1;
    }

    const out = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return res.json(out);
  } catch (e) {
    console.error('[GET /tickets/stats/agents]', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// PUT /tickets/:id
// Generic update endpoint used as a fallback by the UI to set status/resolutionText
r.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionText } = req.body as { status?: string; resolutionText?: any };
    const auth = (req as any).auth;

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
      return res.status(403).json({ message: 'Not your ticket' });
    }

    // Only allow updating a restricted set of fields
    if (typeof status !== 'undefined') {
      if (!['open', 'resolved', 'unreachable', 'reported'].includes(String(status))) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      t.status = String(status) as any;
    }

    if (typeof resolutionText !== 'undefined') {
      t.resolutionText = String(resolutionText ?? '');
    }

    await t.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[PUT /tickets/:id]', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

r.post('/:id/unreachable', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionText, scheduleDateTime } = req.body as { resolutionText: string; scheduleDateTime?: string };
    const auth = (req as any).auth;

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
      return res.status(403).json({ message: 'Not your ticket' });
    }

    const msg = String((resolutionText ?? '')).trim();
    t.status = 'unreachable';
    t.resolutionText = msg;

    // Grup mesajını hemen gönder
    try {
      if (t.telegram?.chatId && t.telegram?.messageId) {
        await sendReply(t.telegram.chatId, t.telegram.messageId, msg || 'wp üzerinden iletişime geçildi');
      }
    } catch (e) {
      console.error('[tickets:unreachable] group send failed', e);
    }

    // Eğer zamanlama varsa, parse et ve eğer geçmişe tarihlendiyse DM'i hemen gönder,
    // gelecekte bir tarihse scheduledDMAt olarak kaydet
    let scheduledDate: Date | null = null;
    if (scheduleDateTime) {
      const parsed = new Date(scheduleDateTime);
      if (!isNaN(parsed.getTime())) {
        scheduledDate = parsed;
      } else {
        console.warn('[tickets:unreachable] invalid scheduleDateTime, will treat as immediate', scheduleDateTime);
      }
    }

    if (scheduledDate && scheduledDate.getTime() > Date.now()) {
      // future date -> persist and scheduler will pick it up
      t.scheduledDMAt = scheduledDate;
      await t.save();
    } else {
      // no schedule or schedule in past/invalid -> don't persist scheduledDMAt and send DM now
      t.scheduledDMAt = undefined;
      await t.save();

      try {
        const actor = await Agent.findById(auth.sub);
        if (actor?.telegramUserId && t.telegram?.text) {
          await sendDM(actor.telegramUserId, `Lütfen ${t.telegram.text} konusu ile ilgili müşteri ile iletişime geç.`);
        }
      } catch (e) {
        console.error('[tickets:unreachable] dm failed', e);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[POST /tickets/:id/unreachable]', e);
    res.status(500).json({ message: 'Internal error' });
  }
});

// POST /tickets/:id/analyze
// Save difficulty + optional note for a ticket (agent analysis)
r.post('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const { difficulty, note } = req.body as { difficulty?: string; note?: string };
    const auth = (req as any).auth;

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
      return res.status(403).json({ message: 'Not your ticket' });
    }

    const entry: any = { at: new Date(), byAgentId: auth.sub };
    if (difficulty && ['easy', 'medium', 'hard'].includes(String(difficulty))) entry.difficulty = String(difficulty);
    if (typeof note !== 'undefined') entry.note = String(note || '');

    t.analysis = t.analysis || [];
    t.analysis.push(entry);
    await t.save();

    return res.json({ ok: true });
  } catch (e) {
    console.error('[POST /tickets/:id/analyze]', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// GET /tickets/analysis
// Query tickets within a date range and optionally by agent; returns ticket list with analysis
r.get('/analysis', async (req, res) => {
  try {
    const { from, to, agentId } = req.query as any;
    const q: any = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) q.createdAt = { ...(q.createdAt || {}), $gte: d };
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) q.createdAt = { ...(q.createdAt || {}), $lte: d };
    }
    if (agentId) q.assignedTo = agentId;

    const list = await Ticket.find(q)
      .select('telegram assignedTo status createdAt analysis resolutionText')
      .populate('assignedTo', 'name externalUserId')
      .lean();

    const out = list.map((t: any) => ({
      id: String(t._id),
      createdAt: t.createdAt,
      status: t.status,
      telegram: t.telegram,
      assignedTo: t.assignedTo && typeof t.assignedTo === 'object' ? { id: String(t.assignedTo._id), name: t.assignedTo.name, externalUserId: String(t.assignedTo.externalUserId) } : t.assignedTo,
      analysis: t.analysis || [],
      resolutionText: t.resolutionText
    }));

    return res.json(out);
  } catch (e) {
    console.error('[GET /tickets/analysis]', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

r.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const auth = (req as any).auth as { sub: string; role: 'supervisor' };

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });

    if (auth.role === 'supervisor') {
      await t.deleteOne();
      return res.json({ ok: true });
    }
    return res.status(403).json({ message: 'Forbidden' });
  } catch (e) {
    console.error('[DELETE /tickets/:id] error', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});
r.put('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { toAgentId } = req.body as { toAgentId?: string };
    const auth = (req as any).auth as { sub: string; role: 'agent' | 'supervisor' };

    if (!toAgentId) return res.status(400).json({ message: 'toAgentId zorunlu' });

  // Bilet ve ajanlar
  const t = await Ticket.findById(id);
  if (!t) return res.status(404).json({ message: 'Ticket bulunamadı' });


  console.log('[tickets:assign] incoming', { ticketId: id, authSub: auth.sub, toAgentId, assignedToBefore: String(t.assignedTo) });

    // Atama izni kontrolü
  const requester = await Agent.findById(auth.sub).lean();
  if (!requester) console.warn('[tickets:assign] requester not found for auth.sub', auth.sub);
  else console.log('[tickets:assign] requester', { id: requester._id.toString(), externalUserId: requester.externalUserId, role: requester.role });
    const isSuperAgent = auth.role === 'supervisor' || ['1', '1009'].includes(String(requester?.externalUserId));
    
    // Eğer süper ajan değilse, sadece kendisine atanmış görevleri yeniden atayabilir
    if (!isSuperAgent && String(t.assignedTo) !== auth.sub) {
      console.warn('[tickets:assign] forbidden - requester not allowed to reassign', { requesterId: auth.sub, ticketAssignedTo: String(t.assignedTo) });
      return res.status(403).json({ message: 'Bu görevi yeniden atama yetkiniz yok' });
    }

    const fromAgent = t.assignedTo ? await Agent.findById(t.assignedTo).lean() : null;

    // toAgentId may be either Mongo _id or an externalUserId — try both
  let toAgent: any = null;
  let usedFallback = false;
  let matchedBy: 'id' | 'externalUserId' | null = null;
    try {
      if (Types.ObjectId.isValid(String(toAgentId))) {
    toAgent = await Agent.findById(toAgentId).lean();
    if (toAgent) matchedBy = 'id';
      } else {
        console.warn('[tickets:assign] toAgentId is not a valid ObjectId, will try externalUserId lookup', toAgentId);
      }
    } catch (e) {
      console.warn('[tickets:assign] findById threw, will fallback to externalUserId', e);
    }

    if (!toAgent) {
      toAgent = await Agent.findOne({ externalUserId: String(toAgentId) }).lean();
      if (toAgent) matchedBy = 'externalUserId';
      if (toAgent) usedFallback = true;
    }

    if (usedFallback) console.warn('[tickets:assign] toAgentId matched by externalUserId fallback', toAgent.externalUserId, toAgent._id);
    if (!toAgent) {
      console.warn('[tickets:assign] toAgent not found for toAgentId', toAgentId);
      return res.status(400).json({ message: 'Hedef agent bulunamadı' });
    }

    console.log('[tickets:assign] resolved toAgent', { matchedBy, toAgentId: String(toAgent._id), toAgentName: toAgent.name, toAgentExternalId: String(toAgent.externalUserId) });

    // Business rule: never allow assigning to externalUserId '1'
    if (String(toAgent.externalUserId) === '1') {
      console.warn('[tickets:assign] prevented assign to externalUserId=1');
      return res.status(400).json({ message: 'Bu kullanıcıya atama yapılamaz' });
    }
  // Güncelle
  t.assignedTo = toAgent._id;
  t.assignedAt = new Date();
  // push history
  t.history = t.history || [];
  t.history.push({ at: new Date(), byAgentId: requester?._id, action: 'reassign', note: `from ${String(fromAgent?._id || '—')} to ${String(toAgent._id)}` });
  await t.save();

  console.log('[tickets:assign] saved', { ticketId: id, assignedToAfter: String(t.assignedTo) });

    // Telegram’a bildir (orijinal mesaja reply)
    const fromName = fromAgent?.name || '—';
    const toName = toAgent.name || '—';
    const notify = `Görev el değiştirdi\n${fromName} => ${toName}`;

    try {
      if (t.telegram?.chatId && t.telegram?.messageId) {
        await sendReply(t.telegram.chatId, t.telegram.messageId, notify);
      }
    } catch (e) {
      console.error('[tickets:assign] telegram notify fail', e);
      // Bildirim düşmese de atama başarılıdır; 200 döndürmeye devam ediyoruz.
    }

  return res.json({ ok: true, assignedTo: { id: String(toAgent._id), name: toAgent.name }, matchedBy });
  } catch (e) {
    console.error('[PUT /tickets/:id/assign] error', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// POST /tickets/:id/notify
// Send a plain reply message to the ticket chat without changing ticket state.
r.post('/:id/notify', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body as { message?: string };
    const auth = (req as any).auth;

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
      return res.status(403).json({ message: 'Not your ticket' });
    }

    const msg = String((message ?? '')).trim() || 'Konu yazılıma iletilmiştir';

    try {
      if (t.telegram?.chatId && t.telegram?.messageId) {
        await sendReply(t.telegram.chatId, t.telegram.messageId, msg);
      }
    } catch (e) {
      console.error('[tickets:notify] send failed', e);
      return res.status(500).json({ message: 'Send failed' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[POST /tickets/:id/notify]', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// POST /tickets/:id/notify-sender
// Send a private DM to the original telegram sender (do NOT reply in group)
r.post('/:id/notify-sender', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body as { message?: string };
    const auth = (req as any).auth;

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
      return res.status(403).json({ message: 'Not your ticket' });
    }

    const from = (t as any).telegram?.from || {};
    const userId = from.id || from.telegramUserId || null;
    if (!userId) return res.status(400).json({ message: 'No sender id available' });

    const baseMsg = String((message ?? '').trim()) || 'Mesajınız hatalı, iletişim alanı zorunludur.';
    const original = (t as any).telegram?.text || '(orijinal mesaj yok)';
    const text = `${baseMsg}\n\nOrijinal mesaj:\n${original}`;

    try {
      await sendDM(Number(userId), text);
    } catch (e) {
      console.error('[tickets:notify-sender] sendDM failed', e);
      return res.status(500).json({ message: 'Send failed' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[POST /tickets/:id/notify-sender]', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

export default r;

