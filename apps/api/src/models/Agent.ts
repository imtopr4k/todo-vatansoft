import { Schema, model } from 'mongoose';

const AgentSchema = new Schema({
  externalUserId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  telegramUserId: { type: Number },
  password: { type: String, required: true },
  role: { type: String, enum: ['agent', 'supervisor'], default: 'agent' },
  isActive: { type: Boolean, default: false },
  lastActivityAt: { type: Date }
}, { timestamps: true });

export const Agent = model('Agent', AgentSchema);
