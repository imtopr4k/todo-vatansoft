"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessage = void 0;
const mongoose_1 = require("mongoose");
const chatMessageSchema = new mongoose_1.Schema({
    ticketId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    fromType: { type: String, enum: ['agent', 'user'], required: true },
    fromId: { type: String, required: true },
    fromName: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
    read: { type: Boolean, default: false }
});
// Otomatik silme: 60 gün sonra
chatMessageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });
exports.ChatMessage = (0, mongoose_1.model)('ChatMessage', chatMessageSchema);
