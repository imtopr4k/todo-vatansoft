import { Schema, model } from 'mongoose';

export interface IBotLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  event: string;
  data?: any;
  message?: string;
  chatId?: string;
  messageId?: number;
  fromId?: string;
  isBot?: boolean;
}

const BotLogSchema = new Schema<IBotLog>({
  timestamp: { type: Date, default: () => new Date(), index: true },
  level: { type: String, enum: ['info', 'warn', 'error', 'debug'], default: 'info' },
  event: { type: String, required: true },
  data: { type: Schema.Types.Mixed },
  message: { type: String },
  chatId: { type: String },
  messageId: { type: Number },
  fromId: { type: String },
  isBot: { type: Boolean }
}, { timestamps: true });

// TTL index - 30 gün sonra otomatik sil
BotLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

export const BotLog = model<IBotLog>('BotLog', BotLogSchema);
