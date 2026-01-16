import mongoose from 'mongoose';
import { Ticket } from '../src/models/Ticket';
import { Agent } from '../src/models/Agent';
import { connectMongo } from '../src/db';

async function migrateHistoryNotes() {
  try {
    console.log('Connecting to MongoDB...');
    await connectMongo();
    console.log('Connected!');

    // Tüm ticket'ları al
    const tickets = await Ticket.find({ 'history.0': { $exists: true } }).lean();
    console.log(`Found ${tickets.length} tickets with history`);

    let updatedCount = 0;

    for (const ticket of tickets) {
      let needsUpdate = false;
      const updatedHistory = [];

      for (const h of ticket.history || []) {
        // "from ... to ..." pattern'ini kontrol et
        const match = String(h.note).match(/^from\s+([a-f0-9]{24}|\S+)\s+to\s+([a-f0-9]{24}|\S+)$/i);
        
        if (match) {
          needsUpdate = true;
          const fromId = match[1];
          const toId = match[2];

          // Agent isimlerini bul
          let fromName = 'Atanmamış';
          let toName = 'Bilinmiyor';

          if (fromId !== '—' && mongoose.Types.ObjectId.isValid(fromId)) {
            const fromAgent = await Agent.findById(fromId).select('name').lean();
            if (fromAgent) fromName = fromAgent.name;
          }

          if (mongoose.Types.ObjectId.isValid(toId)) {
            const toAgent = await Agent.findById(toId).select('name').lean();
            if (toAgent) toName = toAgent.name;
          }

          // İşlemi yapan agent
          let requesterName = 'Sistem';
          if (h.byAgentId && mongoose.Types.ObjectId.isValid(String(h.byAgentId))) {
            const requester = await Agent.findById(h.byAgentId).select('name').lean();
            if (requester) requesterName = requester.name;
          }

          // Yeni note formatı
          const newNote = `${fromName} => ${toName} olarak atandı. İşlemi yapan: ${requesterName}`;
          
          updatedHistory.push({
            ...h,
            note: newNote
          });

          console.log(`  Updated: "${h.note}" -> "${newNote}"`);
        } else {
          updatedHistory.push(h);
        }
      }

      if (needsUpdate) {
        await Ticket.findByIdAndUpdate(ticket._id, { history: updatedHistory });
        updatedCount++;
        console.log(`✓ Ticket ${String(ticket._id).slice(-6)} updated`);
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updatedCount} tickets.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateHistoryNotes();
