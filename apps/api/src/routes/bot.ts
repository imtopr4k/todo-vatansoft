import { Router } from 'express';
import { Ticket } from '../models/Ticket';
import { assignAgentForMessage } from '../services/assigner';
import { sendReply } from '../services/telegram';
import { Agent } from '../models/Agent';

const r = Router();
r.post('/link', async (req, res) => {
  const { agentId, telegramUserId } = req.body as { agentId: string; telegramUserId: string };
  if (!agentId || !telegramUserId) {
    return res.status(400).json({ message: 'agentId ve telegramUserId zorunlu' });
  }

  const a = await Agent.findById(agentId);
  if (!a) return res.status(404).json({ message: 'Agent bulunamadı' });

  a.telegramUserId = Number(telegramUserId);
  await a.save();

  return res.json({ ok: true });
});
r.post('/intake', async (req, res) => {
  const { chatId, messageId, text, from } = req.body as any;

  let chosen: { id: string; name: string };
  try {
    chosen = await assignAgentForMessage(text);
  } catch (e) {
    if ((e as Error).message === 'NO_ACTIVE_AGENT') {
      await sendReply(chatId, messageId, 'Atanacak aktif agent bulunamadı.');
      return res.status(409).json({ message: 'NO_ACTIVE_AGENT' });
    }
    throw e;
  }

  const t = await Ticket.create({
    source: 'telegram',
    telegram: {
      chatId, messageId, text,
      from: from ? {
        id: from.id,
        username: from.username,
        firstName: from.firstName,
        lastName: from.lastName,
        displayName: from.displayName
      } : undefined
    },
    assignedTo: chosen.id,
    assignedAt: new Date(),
    status: 'open'
  });

  await sendReply(chatId, messageId, `Görev ${chosen.name}'e atandı.`);
  res.json({ ticketId: String(t._id) });
});


export default r;
