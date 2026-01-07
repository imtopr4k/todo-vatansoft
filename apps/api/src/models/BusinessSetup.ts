import { Schema, model } from 'mongoose';

const BusinessSetupSchema = new Schema({
  memberId: { type: String, required: true },
  status: { type: String, required: true },
  description: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });

export const BusinessSetup = model('BusinessSetup', BusinessSetupSchema);
