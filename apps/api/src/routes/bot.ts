import { Router } from 'express';
import { Ticket } from '../models/Ticket';
import { assignAgentForMessage } from '../services/assigner';
import { sendReply, sendDM } from '../services/telegram';
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
      // No active agent: create a ticket without assignedTo and keep it pending.
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
        status: 'open'
      });

      try {
        await sendReply(chatId, messageId, 'Atanacak aktif agent bulunamadı; mesaj sıraya alındı. En kısa sürede atanacaktır.');
      } catch (ex) {
      }

      return res.status(200).json({ ticketId: String(t._id), pending: true });
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

  // Gruba sadece bilgilendirme mesajı gönder (buton YOK)
  await sendReply(chatId, messageId, `Görev ${chosen.name}'e atandı.`);
  
  // Real-time bildirim gönder
  try {
    const io = (global as any).io;
    if (io) {
      io.emit('new_ticket', {
        ticketId: String(t._id),
        assignedTo: chosen.id,
        assignedToName: chosen.name,
        text: text,
        from: from?.displayName || 'Bilinmiyor',
        isUrgent: false,
        status: 'open',
        createdAt: new Date().toISOString()
      });
      console.log('[socket] Emitted new_ticket:', String(t._id));
    }
  } catch (err) {
    console.error('[socket] Failed to emit new_ticket:', err);
  }
  
  // Kullanıcıya özelden acil butonu gönder
  if (from?.id) {
    try {
      const userMessage = `📋 Talebiniz alındı ve ${chosen.name}'e atandı.\n\nEğer bu talep acilse, aşağıdaki butona tıklayarak işaretleyebilirsiniz:`;
      await sendDM(from.id, userMessage, [
        [{ text: '🔴 Acil mi?', callback_data: `urgent:${String(t._id)}` }]
      ]);
    } catch (err) {
      console.error('[bot] Failed to send urgent button to user:', err);
    }
  }
  
  res.json({ ticketId: String(t._id) });
});

r.post('/tickets/:ticketId/mark-urgent', async (req, res) => {
  const { ticketId } = req.params;
  console.log('[API] mark-urgent called for ticket:', ticketId);
  
  const t = await Ticket.findById(ticketId);
  if (!t) {
    console.log('[API] Ticket not found:', ticketId);
    return res.status(404).json({ message: 'Ticket bulunamadı' });
  }
  
  console.log('[API] Before update - isUrgent:', t.isUrgent);
  t.isUrgent = true;
  await t.save();
  console.log('[API] After update - isUrgent:', t.isUrgent);
  
  return res.json({ ok: true });
});

r.post('/ping', (req, res) => {
  console.log('[API] Ping received');
  return res.json({ pong: true, timestamp: Date.now() });
});

export default r;
