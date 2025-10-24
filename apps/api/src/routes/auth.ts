import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Agent } from '../models/Agent';
import { signAccessToken } from '../services/jwt';

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

r.post('/heartbeat', async (req, res) => {
  const { agentId } = req.body as { agentId: string };
  await Agent.findByIdAndUpdate(agentId, { lastActivityAt: new Date() });
  res.json({ ok: true });
});

export default r;
