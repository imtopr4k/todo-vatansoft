import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { Ticket } from '../models/Ticket';
import { Agent } from '../models/Agent';
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
    const auth = (req as any).auth;

    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (auth.role !== 'supervisor' && String(t.assignedTo) !== auth.sub) {
      return res.status(403).json({ message: 'Not your ticket' });
    }

    t.status = 'unreachable';
    await t.save();

    try {
      await sendReply(t.telegram.chatId, t.telegram.messageId, 'wp üzerinden iletişime geçildi');
    } catch (e) {
      console.error('[tickets:unreachable] group send failed', e);
    }

    try {
      const actor = await Agent.findById(auth.sub);
      if (actor?.telegramUserId) {
        await sendDM(actor.telegramUserId, 'Ulaşılamadı işaretledin. Lütfen gerekli takibi yap.');
      }
    } catch (e) {
      console.error('[tickets:unreachable] dm failed', e);
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

    // isteyen kişi supervisor mı ya da externalUserId'si 1 veya 1009 mu?
    const requester = await Agent.findById(auth.sub).lean();
    const canReassign =
      auth.role === 'supervisor' ||
      ['1', '1009'].includes(String(requester?.externalUserId));

    if (!canReassign) return res.status(403).json({ message: 'Yetkisiz' });

    // Bilet ve ajanlar
    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ message: 'Ticket bulunamadı' });

    const fromAgent = t.assignedTo ? await Agent.findById(t.assignedTo).lean() : null;
    const toAgent = await Agent.findById(toAgentId).lean();
    if (!toAgent) return res.status(400).json({ message: 'Hedef agent bulunamadı' });
    // Güncelle
    t.assignedTo = toAgent._id;
    t.assignedAt = new Date();
    await t.save();

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

    return res.json({ ok: true });
  } catch (e) {
    console.error('[PUT /tickets/:id/assign] error', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

export default r;
