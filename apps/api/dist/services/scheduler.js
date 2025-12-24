"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initScheduler = initScheduler;
const Ticket_1 = require("../models/Ticket");
const telegram_1 = require("./telegram");
async function initScheduler() {
    // Her dakika kontrol et
    setInterval(checkScheduledDMs, 60000);
}
async function checkScheduledDMs() {
    try {
        const now = new Date();
        const tickets = await Ticket_1.Ticket.find({
            status: 'unreachable',
            scheduledDMAt: { $lte: now, $exists: true },
        }).populate('assignedTo');
        for (const ticket of tickets) {
            try {
                const agent = ticket.assignedTo;
                if (agent?.telegramUserId && ticket.telegram?.text) {
                    await (0, telegram_1.sendDM)(agent.telegramUserId, `Lütfen ${ticket.telegram.text} konusu ile ilgili müşteri ile iletişime geç.`);
                }
                // DM gönderildikten sonra zamanlamayı temizle
                ticket.scheduledDMAt = undefined;
                await ticket.save();
            }
            catch (e) {
            }
        }
    }
    catch (e) {
    }
}
