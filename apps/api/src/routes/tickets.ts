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

    if (status && !['open', 'resolved', 'unreachable'].includes(String(status))) {
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

export default r;
