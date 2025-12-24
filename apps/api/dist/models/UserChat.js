"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserChat = void 0;
const mongoose_1 = require("mongoose");
const userChatSchema = new mongoose_1.Schema({
    userId: { type: Number, required: true, unique: true, index: true },
    chatId: { type: Number, required: true },
    firstName: { type: String },
    lastName: { type: String },
    username: { type: String },
    registeredAt: { type: Date, default: () => new Date() },
    lastActive: { type: Date, default: () => new Date() }
}, {
    timestamps: true
});
exports.UserChat = (0, mongoose_1.model)('UserChat', userChatSchema);
