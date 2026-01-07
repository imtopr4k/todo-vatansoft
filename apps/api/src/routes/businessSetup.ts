import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { BusinessSetup } from '../models/BusinessSetup';

const r = Router();
r.use(requireAuth);

// Tüm business setup kayıtlarını getir
r.get('/', async (req, res) => {
  try {
    const items = await BusinessSetup.find()
      .populate('createdBy', 'name externalUserId')
      .populate('updatedBy', 'name externalUserId')
      .sort({ createdAt: -1 })
      .lean();

    const result = items.map((item) => ({
      id: String(item._id),
      memberId: item.memberId,
      status: item.status,
      description: item.description,
      createdBy: item.createdBy ? {
        id: String((item.createdBy as any)._id),
        name: (item.createdBy as any).name,
        externalUserId: (item.createdBy as any).externalUserId,
      } : undefined,
      updatedBy: item.updatedBy ? {
        id: String((item.updatedBy as any)._id),
        name: (item.updatedBy as any).name,
        externalUserId: (item.updatedBy as any).externalUserId,
      } : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return res.json(result);
  } catch (err) {
    console.error('[API] Error fetching business setups:', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// Yeni business setup ekle
r.post('/', async (req, res) => {
  try {
    const { memberId, status, description } = req.body;
    const auth = (req as any).auth as { sub: string };

    if (!memberId || !status || !description) {
      return res.status(400).json({ message: 'memberId, status ve description zorunludur' });
    }

    const newItem = new BusinessSetup({
      memberId,
      status,
      description,
      createdBy: auth.sub,
    });

    await newItem.save();
    await newItem.populate('createdBy', 'name externalUserId');

    return res.json({
      id: String(newItem._id),
      memberId: newItem.memberId,
      status: newItem.status,
      description: newItem.description,
      createdBy: (newItem as any).createdBy ? {
        id: String((newItem as any).createdBy._id),
        name: (newItem as any).createdBy.name,
        externalUserId: (newItem as any).createdBy.externalUserId,
      } : undefined,
      createdAt: newItem.createdAt,
      updatedAt: newItem.updatedAt,
    });
  } catch (err) {
    console.error('[API] Error creating business setup:', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// Business setup güncelle
r.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { memberId, status, description } = req.body;
    const auth = (req as any).auth as { sub: string };

    const item = await BusinessSetup.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Business setup bulunamadı' });
    }

    if (memberId !== undefined) item.memberId = memberId;
    if (status !== undefined) item.status = status;
    if (description !== undefined) item.description = description;
    (item as any).updatedBy = auth.sub;

    await item.save();
    await item.populate('createdBy', 'name externalUserId');
    await item.populate('updatedBy', 'name externalUserId');

    return res.json({
      id: String(item._id),
      memberId: item.memberId,
      status: item.status,
      description: item.description,
      createdBy: (item as any).createdBy ? {
        id: String((item as any).createdBy._id),
        name: (item as any).createdBy.name,
        externalUserId: (item as any).createdBy.externalUserId,
      } : undefined,
      updatedBy: (item as any).updatedBy ? {
        id: String((item as any).updatedBy._id),
        name: (item as any).updatedBy.name,
        externalUserId: (item as any).updatedBy.externalUserId,
      } : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  } catch (err) {
    console.error('[API] Error updating business setup:', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

// Business setup sil
r.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await BusinessSetup.findByIdAndDelete(id);
    if (!item) {
      return res.status(404).json({ message: 'Business setup bulunamadı' });
    }

    return res.json({ message: 'Silindi' });
  } catch (err) {
    console.error('[API] Error deleting business setup:', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

export default r;
