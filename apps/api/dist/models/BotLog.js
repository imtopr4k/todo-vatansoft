"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotLog = void 0;
const mongoose_1 = require("mongoose");
const BotLogSchema = new mongoose_1.Schema({
    timestamp: { type: Date, default: () => new Date(), index: true },
    level: { type: String, enum: ['info', 'warn', 'error', 'debug'], default: 'info' },
    event: { type: String, required: true },
    data: { type: mongoose_1.Schema.Types.Mixed },
    message: { type: String },
    chatId: { type: String },
    messageId: { type: Number },
    fromId: { type: String },
    isBot: { type: Boolean }
}, { timestamps: true });
// TTL index - 30 gün sonra otomatik sil
BotLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days
exports.BotLog = (0, mongoose_1.model)('BotLog', BotLogSchema);
