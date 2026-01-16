"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ticket = void 0;
const mongoose_1 = require("mongoose");
const TicketSchema = new mongoose_1.Schema({
    source: { type: String, enum: ['telegram'], required: true },
    telegram: {
        chatId: { type: Number, required: true },
        messageId: { type: Number, required: true },
        resolutionMessageId: { type: Number },
        userChatId: { type: Number }, // Kullanıcının özel chat ID'si (DM için)
        // Yeni alanlar: web'de görselleştirme için
        text: { type: String }, // Mesaj içeriği
        from: {
            id: { type: Number }, // telegram user id
            username: { type: String },
            firstName: { type: String },
            lastName: { type: String },
            displayName: { type: String } // first + last fallback
        }
    },
    status: { type: String, enum: ['open', 'resolved', 'unreachable', 'reported', 'waiting'], default: 'open' },
    assignedTo: { type: mongoose_1.Types.ObjectId, ref: 'Agent' },
    assignedAt: { type: Date, default: Date.now },
    isUrgent: { type: Boolean, default: false },
    resolutionText: { type: String },
    scheduledDMAt: { type: Date },
    unattendedWarningAt: { type: Date }, // 5dk uyarısı gönderildi mi
    interestedBy: { type: mongoose_1.Types.ObjectId, ref: 'Agent' },
    interestedAt: { type: Date },
    // Analysis data: agents can record difficulty and notes for the ticket
    analysis: [{
            difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
            note: { type: String },
            byAgentId: { type: mongoose_1.Types.ObjectId, ref: 'Agent' },
            at: { type: Date, default: Date.now }
        }],
    history: [{
            at: { type: Date, default: Date.now },
            byAgentId: { type: mongoose_1.Types.ObjectId, ref: 'Agent' },
            action: { type: String },
            note: { type: String }
        }]
}, { timestamps: true });
exports.Ticket = (0, mongoose_1.model)('Ticket', TicketSchema);
