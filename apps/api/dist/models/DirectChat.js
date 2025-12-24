"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectChatMessage = void 0;
const mongoose_1 = require("mongoose");
const directChatMessageSchema = new mongoose_1.Schema({
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
exports.DirectChatMessage = (0, mongoose_1.model)('DirectChatMessage', directChatMessageSchema);
