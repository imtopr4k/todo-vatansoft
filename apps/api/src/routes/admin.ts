import { Router } from 'express';
import { Rotation } from '../models/Rotation';
import { requireAuth } from '../middlewares/auth';

const r = Router();
r.use(requireAuth);

r.post('/rotation/reset', async (req: any, res) => {
    if (req.auth?.role !== 'supervisor') return res.status(403).json({ message: 'forbidden' });

    await Rotation.replaceOne(
        { _id: 'telegram' },
        { _id: 'telegram', index: 0, cycle: 0, assignedThisCycle: [] },
        { upsert: true }
    );
    res.json({ ok: true });
});

export default r;
