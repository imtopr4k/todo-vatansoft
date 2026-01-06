import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { BusinessSetup } from '../models/BusinessSetup';

const r = Router();
r.use(requireAuth);

// Tüm business setup kayıtlarını getir
r.get('/', async (req, res) => {
  try {
    const items = await BusinessSetup.find()
      .sort({ createdAt: -1 })
      .lean();

    const result = items.map((item) => ({
      id: String(item._id),
      memberId: item.memberId,
      status: item.status,
      description: item.description,
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

    if (!memberId || !status || !description) {
      return res.status(400).json({ message: 'memberId, status ve description zorunludur' });
    }

    const newItem = new BusinessSetup({
      memberId,
      status,
      description,
    });

    await newItem.save();

    return res.json({
      id: String(newItem._id),
      memberId: newItem.memberId,
      status: newItem.status,
      description: newItem.description,
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

    const item = await BusinessSetup.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Business setup bulunamadı' });
    }

    if (memberId !== undefined) item.memberId = memberId;
    if (status !== undefined) item.status = status;
    if (description !== undefined) item.description = description;

    await item.save();

    return res.json({
      id: String(item._id),
      memberId: item.memberId,
      status: item.status,
      description: item.description,
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
