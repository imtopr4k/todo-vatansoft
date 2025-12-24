"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const mongoose_1 = require("mongoose");
const AgentSchema = new mongoose_1.Schema({
    externalUserId: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    telegramUserId: { type: Number },
    password: { type: String, required: true },
    role: { type: String, enum: ['agent', 'supervisor'], default: 'agent' },
    isActive: { type: Boolean, default: false },
    lastActivityAt: { type: Date }
}, { timestamps: true });
exports.Agent = (0, mongoose_1.model)('Agent', AgentSchema);
