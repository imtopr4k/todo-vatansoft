import { Schema, model, Types } from 'mongoose';

const AssignmentLogSchema = new Schema({
  ticketId: { type: Types.ObjectId, ref: 'Ticket', required: true },
  fromAgentId: { type: Types.ObjectId, ref: 'Agent' },
  toAgentId: { type: Types.ObjectId, ref: 'Agent', required: true },
  reason: { type: String, enum: ['auto-assign', 'manual-reassign'], required: true },
  at: { type: Date, default: Date.now }
});

export const AssignmentLog = model('AssignmentLog', AssignmentLogSchema);
