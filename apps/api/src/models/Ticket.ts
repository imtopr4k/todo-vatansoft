import { Schema, model, Types } from 'mongoose';

const TicketSchema = new Schema({
  source: { type: String, enum: ['telegram'], required: true },
  telegram: {
    chatId: { type: Number, required: true },
    messageId: { type: Number, required: true },

    // Yeni alanlar: web’de görselleştirme için
    text: { type: String },                                        // Mesaj içeriği
    from: {                                                        // Gönderen bilgisi
      id: { type: Number },                                        // telegram user id
      username: { type: String },
      firstName: { type: String },
      lastName: { type: String },
      displayName: { type: String }                                // first + last fallback
    }
  },
  status: { type: String, enum: ['open', 'resolved', 'unreachable'], default: 'open' },
  assignedTo: { type: Types.ObjectId, ref: 'Agent', required: true },
  assignedAt: { type: Date, default: Date.now },
  resolutionText: { type: String },
  history: [{
    at: { type: Date, default: Date.now },
    byAgentId: { type: Types.ObjectId, ref: 'Agent' },
    action: { type: String },
    note: { type: String }
  }]
}, { timestamps: true });

export const Ticket = model('Ticket', TicketSchema);
