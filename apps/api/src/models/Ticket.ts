import { Schema, model, Types } from 'mongoose';

const TicketSchema = new Schema({
  source: { type: String, enum: ['telegram'], required: true },
  telegram: {
    chatId: { type: Number, required: true },
    messageId: { type: Number, required: true },
    resolutionMessageId: { type: Number },
    userChatId: { type: Number },                                  // Kullanıcının özel chat ID'si (DM için)
    // Yeni alanlar: web'de görselleştirme için
    text: { type: String },                                        // Mesaj içeriği
    from: {                                                        // Gönderen bilgisi
      id: { type: Number },                                        // telegram user id
      username: { type: String },
      firstName: { type: String },
      lastName: { type: String },
      displayName: { type: String }                                // first + last fallback
    }
  },
  status: { type: String, enum: ['open', 'resolved', 'unreachable', 'reported', 'waiting'], default: 'open' },
  assignedTo: { type: Types.ObjectId, ref: 'Agent' },
  assignedAt: { type: Date, default: Date.now },
  isUrgent: { type: Boolean, default: false },
  resolutionText: { type: String },
  scheduledDMAt: { type: Date },
  unattendedWarningAt: { type: Date },                           // 5dk uyarısı gönderildi mi
  interestedBy: { type: Types.ObjectId, ref: 'Agent' },
  interestedAt: { type: Date },
  // Analysis data: agents can record difficulty and notes for the ticket
  analysis: [{
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    note: { type: String },
    byAgentId: { type: Types.ObjectId, ref: 'Agent' },
    at: { type: Date, default: Date.now }
  }],
  history: [{
    at: { type: Date, default: Date.now },
    byAgentId: { type: Types.ObjectId, ref: 'Agent' },
    action: { type: String },
    note: { type: String }
  }]
}, { timestamps: true });

export const Ticket = model('Ticket', TicketSchema);
