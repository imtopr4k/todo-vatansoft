import { Schema, model } from 'mongoose';

const BusinessSetupSchema = new Schema({
  memberId: { type: String, required: true },
  status: { type: String, required: true },
  description: { type: String, required: true },
}, { timestamps: true });

export const BusinessSetup = model('BusinessSetup', BusinessSetupSchema);
