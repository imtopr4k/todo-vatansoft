import { Schema, model, Document } from 'mongoose';

export interface IChatMessage extends Document {
  ticketId: Schema.Types.ObjectId;
  fromType: 'agent' | 'user';
  fromId: string; // agentId veya Telegram userId
  fromName: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const chatMessageSchema = new Schema<IChatMessage>({
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
  fromType: { type: String, enum: ['agent', 'user'], required: true },
  fromId: { type: String, required: true },
  fromName: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: () => new Date() },
  read: { type: Boolean, default: false }
});

// Otomatik silme: 60 gün sonra
chatMessageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

export const ChatMessage = model<IChatMessage>('ChatMessage', chatMessageSchema);
