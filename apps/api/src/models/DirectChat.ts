import { Schema, model, Document } from 'mongoose';

// Genel sohbet mesajları (ticket olmadan)
export interface IDirectChatMessage extends Document {
  userId: number; // Telegram user ID
  userName: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  chatId: number; // Telegram chat ID
  fromType: 'agent' | 'user';
  fromId: string; // agentId veya Telegram userId
  fromName: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const directChatMessageSchema = new Schema<IDirectChatMessage>({
  userId: { type: Number, required: true, index: true },
  userName: { type: String, required: true },
  username: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  chatId: { type: Number, required: true, index: true },
  fromType: { type: String, enum: ['agent', 'user'], required: true },
  fromId: { type: String, required: true },
  fromName: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: () => new Date() },
  read: { type: Boolean, default: false }
});

// Otomatik silme: 60 gün sonra
directChatMessageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

export const DirectChatMessage = model<IDirectChatMessage>('DirectChatMessage', directChatMessageSchema);
