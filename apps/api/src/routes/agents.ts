import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { Agent } from '../models/Agent';

const r = Router();

// 🔎 debug: mount olup olmadığını hızlı test için public ping
r.get('/ping', (_req, res) => res.json({ ok: true, where: 'agents router' }));

// 🔐 tüm /agents/* uçlarını auth ile koru
r.use(requireAuth);

/**
 * GET /agents
 * Liste: name, externalUserId, isActive, role, telegramUserId
 */
r.get('/', async (_req, res) => {
  const list = await Agent.find({})
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

export default r; // ⚠️ default export şart
