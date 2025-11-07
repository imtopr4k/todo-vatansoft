import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Agent } from '../models/Agent';
import { signAccessToken } from '../services/jwt';
import { requireAuth } from '../middlewares/auth';

const r = Router();

// externalUserId + password ile giriş
r.post('/login', async (req, res) => {
  let { externalUserId, password } = req.body as { externalUserId: string; password: string };
  if (!externalUserId || !password) return res.status(400).json({ message: 'externalUserId ve password zorunludur' });

  externalUserId = String(externalUserId).trim();
  const orQuery: any[] = [{ externalUserId }];
  const asNum = Number(externalUserId);
  if (!Number.isNaN(asNum)) orQuery.push({ externalUserId: String(asNum) });

  // Teşhis için geçici log:
  console.log('[login] MONGO_URI=', process.env.MONGO_URI);
  console.log('[login] query=', orQuery);

  const agent = await Agent.findOne({ $or: orQuery });
  if (!agent) return res.status(400).json({ message: 'User Id de sorun var' });

  // Şifre kontrolü (geçiş dönemi için düz metne izin – sonra kaldır)
  let ok = false;
  if ((agent as any).passwordHash) {
    const bcrypt = await import('bcryptjs');
    ok = await bcrypt.compare(password, (agent as any).passwordHash);
  } else if ((agent as any).password) {
    ok = password === (agent as any).password;
  }
  if (!ok) return res.status(400).json({ message: 'Şifre hatalı' });

  agent.isActive = true;
  agent.lastActivityAt = new Date();
  await agent.save();

  const accessToken = signAccessToken({ sub: agent._id.toString(), role: agent.role as any });
  res.json({ accessToken, agent: { id: agent._id, role: agent.role, name: agent.name } });
});


r.post('/logout', async (req, res) => {
  const { agentId } = req.body as { agentId: string };
  await Agent.findByIdAndUpdate(agentId, { isActive: false });
  res.json({ ok: true });
});

// Register endpoint - create new agent
r.post('/register', async (req, res) => {
  try {
    let { name, externalUserId, password, role } = req.body as { name?: string; externalUserId?: string; password?: string; role?: string };
    if (!name || !externalUserId || !password) return res.status(400).json({ message: 'name, externalUserId ve password zorunludur' });
    name = String(name).trim();
    externalUserId = String(externalUserId).trim();
    password = String(password);
    role = role === 'Temsilci' ? 'supervisor' : 'agent';

    // check existing
    const exists = await Agent.findOne({ externalUserId });
    if (exists) return res.status(400).json({ message: 'externalUserId zaten kayıtlı' });

    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(password, 10);

    const a = new Agent({ name, externalUserId: String(externalUserId), passwordHash: hash, role });
    await a.save();

    const accessToken = signAccessToken({ sub: a._id.toString(), role: a.role as any });
    res.json({ accessToken, agent: { id: a._id, role: a.role, name: a.name } });
  } catch (e) {
    console.error('[auth:register] error', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

r.post('/heartbeat', async (req, res) => {
  const { agentId } = req.body as { agentId: string };
  await Agent.findByIdAndUpdate(agentId, { lastActivityAt: new Date() });
  res.json({ ok: true });
});

export default r;

// Set active/inactive for current agent (requires auth)
r.post('/set-active', requireAuth, async (req, res) => {
  try {
    const { isActive } = req.body as { isActive?: boolean };
    const auth = (req as any).auth;
    if (!auth || !auth.sub) return res.status(401).json({ message: 'Unauthorized' });
    const update: any = { isActive: !!isActive };
    if (isActive) update.lastActivityAt = new Date();
    await Agent.findByIdAndUpdate(auth.sub, update);
    console.log('[auth:set-active] agent', auth.sub, 'isActive=', !!isActive);
    return res.json({ ok: true, isActive: !!isActive });
  } catch (e) {
    console.error('[auth:set-active] error', e);
    return res.status(500).json({ message: 'Internal error' });
  }
});
