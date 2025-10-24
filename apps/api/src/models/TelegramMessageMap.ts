import { Schema, model, Types } from 'mongoose';

const TelegramMessageMapSchema = new Schema({
  ticketId: { type: Types.ObjectId, ref: 'Ticket', required: true },
  announceMessageId: { type: Number },
});

export const TelegramMessageMap = model('TelegramMessageMap', TelegramMessageMapSchema);
