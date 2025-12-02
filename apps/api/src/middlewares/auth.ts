import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/jwt';
import { Agent } from '../models/Agent';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = verifyAccessToken(token);
    const agent = await Agent.findById(payload.sub);
    if (!agent) return res.status(401).json({ message: 'Unauthorized' });
    
    // Otomatik çıkış kontrolü kaldırıldı - kullanıcılar manuel çıkış yapana kadar oturumları açık kalacak
    // const last = agent.lastActivityAt?.getTime() ?? 0;
    // const now = Date.now();
    // const idleSec = (now - last) / 1000;
    // if (agent.isActive && agent.lastActivityAt && idleSec > 3600) {
    //   agent.isActive = false;
    //   await agent.save();
    //   return res.status(440).json({ message: 'Session expired by inactivity' });
    // }
    
    (req as any).auth = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

export function requireSupervisor(req: Request, res: Response, next: NextFunction) {
  const { role } = (req as any).auth || {};
  if (role !== 'supervisor') return res.status(403).json({ message: 'Forbidden' });
  next();
}
