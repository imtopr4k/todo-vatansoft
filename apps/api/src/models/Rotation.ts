import mongoose, { Schema, Document } from 'mongoose';

export interface IRotation extends Document {
    _id: string;              // "telegram"
    index: number;
    cycle: number;
    assignedThisCycle: string[];
}

const RotationSchema = new Schema<IRotation>({
    _id: { type: String, required: true },
    index: { type: Number, default: 0 },
    cycle: { type: Number, default: 0 },
    assignedThisCycle: { type: [String], default: [] },
}, {
    strict: 'throw',
    minimize: false
});

// 3. parametre ile koleksiyon adını sabitliyoruz: 'rotations_v2'
export const Rotation = mongoose.model<IRotation>('Rotation', RotationSchema, 'rotations');
