import { Ticket } from '../models/Ticket';
import { sendDM } from './telegram';
import { Agent } from '../models/Agent';

export async function initScheduler() {
  console.log('[scheduler] Initializing scheduler...');
  // Her dakika kontrol et
  setInterval(checkScheduledDMs, 60000);
  // Her dakika ilgilenilmeyen ticket'ları kontrol et
  setInterval(checkUnattendedTickets, 60000);
  // İlk çalıştırmayı hemen yap
  setTimeout(checkUnattendedTickets, 5000); // 5 saniye sonra ilk kontrol
  console.log('[scheduler] Scheduler initialized');
}

// 5 dakika ilgilenilmeyen ticket'lar için tüm agentlara uyarı gönder
async function checkUnattendedTickets() {
  console.log('[scheduler] Checking unattended tickets...');
  try {
    const now = new Date();
    const testTime = new Date(now.getTime() - 5 * 60 * 1000);
    
    console.log(`[scheduler] Looking for tickets older than ${testTime.toISOString()}`);
    
    // Şartlar:
    // 1. status: 'open' - Hala açık olan ticket'lar
    // 2. interestedBy yoksa - Kimse ilgileniyorum dememiş
    // 4. unattendedWarningAt yoksa - Daha önce uyarı gönderilmemiş
    const tickets = await Ticket.find({
      status: 'open',
      interestedBy: { $exists: false },
      createdAt: { $lte: testTime },
      unattendedWarningAt: { $exists: false }
    }).populate('assignedTo');

    console.log(`[scheduler] Found ${tickets.length} unattended tickets`);
    
    if (tickets.length === 0) return;

    // Tüm aktif agentları bul (telegramUserId olan ve externalUserId '1' olmayan)
    const agents = await Agent.find({ 
      isActive: true,
      telegramUserId: { $exists: true, $ne: null }
    }).lean();
    const activeAgents = agents.filter(a => String(a.externalUserId) !== '1');

    console.log(`[scheduler] Found ${activeAgents.length} active agents with telegramUserId:`, activeAgents.map(a => ({ name: a.name, telegramUserId: a.telegramUserId })));

    if (activeAgents.length === 0) {
      console.log('[scheduler] No active agents with telegramUserId found');
      return;
    }

    // Her ticket için tüm agentlara mesaj gönder
    for (const ticket of tickets) {
      try {
        const shortId = String(ticket._id).slice(-6).toUpperCase();
        const assignedAgent = ticket.assignedTo as any;
        const assignedName = assignedAgent?.name || 'Atanmamış';
        const senderName = ticket.telegram?.from?.displayName || 
                          ticket.telegram?.from?.firstName || 
                          ticket.telegram?.from?.username || 'Bilinmiyor';
        
        const warningMessage = `⚠️ DİKKAT: İlgilenilmeyen Görev!\n\n📋 Görev ID: #${shortId}\n👤 Gönderen: ${senderName}\n👤 Atanan: ${assignedName}\n⏰ Süre: 30+ saniye (test)\n\n📬 Mesaj:\n${ticket.telegram?.text || '(Mesaj içeriği yok)'}\n\n🚨 Lütfen acilen ilgilenin!`;
        
        console.log(`[scheduler] Processing ticket #${shortId}, will send to ${activeAgents.length} agents`);
        
        // Her agenta sırayla mesaj gönder
        for (const agent of activeAgents) {
          if (agent.telegramUserId) {
            try {
              await sendDM(agent.telegramUserId, warningMessage);
              console.log(`[scheduler] Sent unattended warning to ${agent.name} for ticket #${shortId}`);
            } catch (dmErr) {
              console.error(`[scheduler] Failed to send warning to agent ${agent.name}:`, dmErr);
            }
          }
        }
        
        // Uyarı gönderildiğini işaretle (bir daha gönderilmesin)
        (ticket as any).unattendedWarningAt = now;
        await ticket.save();
        
        console.log(`[scheduler] Marked ticket #${shortId} as warned (sent to ${activeAgents.length} agents)`);
      } catch (e) {
        console.error('[scheduler] Error processing unattended ticket:', e);
      }
    }
  } catch (e) {
    console.error('[scheduler] Error checking unattended tickets:', e);
  }
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
      }
    }
  } catch (e) {
  }
}