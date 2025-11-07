import { Ticket } from '../models/Ticket';
import { sendDM } from './telegram';
import { Agent } from '../models/Agent';

export async function initScheduler() {
  // Her dakika kontrol et
  setInterval(checkScheduledDMs, 60000);
}

async function checkScheduledDMs() {
  try {
    const now = new Date();
    const tickets = await Ticket.find({
      status: 'unreachable',
      scheduledDMAt: { $lte: now, $exists: true },
    }).populate('assignedTo');

    for (const ticket of tickets) {
      try {
        const agent = ticket.assignedTo as any;
        if (agent?.telegramUserId && ticket.telegram?.text) {
          await sendDM(
            agent.telegramUserId,
            `Lütfen ${ticket.telegram.text} konusu ile ilgili müşteri ile iletişime geç.`
          );
        }
        // DM gönderildikten sonra zamanlamayı temizle
        ticket.scheduledDMAt = undefined;
        await ticket.save();
      } catch (e) {
        console.error(`[scheduler] Failed to send DM for ticket ${ticket.id}:`, e);
      }
    }
  } catch (e) {
    console.error('[scheduler] Error checking scheduled DMs:', e);
  }
}