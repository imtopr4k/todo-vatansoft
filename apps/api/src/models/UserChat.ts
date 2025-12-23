import { Schema, model, Document } from 'mongoose';

export interface IUserChat extends Document {
  userId: number; // Telegram user ID
  chatId: number; // Telegram chat ID (private)
  firstName?: string;
  lastName?: string;
  username?: string;
  registeredAt: Date;
  lastActive?: Date;
}

const userChatSchema = new Schema<IUserChat>({
  userId: { type: Number, required: true, unique: true, index: true },
  chatId: { type: Number, required: true },
  firstName: { type: String },
  lastName: { type: String },
  username: { type: String },
  registeredAt: { type: Date, default: () => new Date() },
  lastActive: { type: Date, default: () => new Date() }
}, {
  timestamps: true
});

export const UserChat = model<IUserChat>('UserChat', userChatSchema);
