"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentLog = void 0;
const mongoose_1 = require("mongoose");
const AssignmentLogSchema = new mongoose_1.Schema({
    ticketId: { type: mongoose_1.Types.ObjectId, ref: 'Ticket', required: true },
    fromAgentId: { type: mongoose_1.Types.ObjectId, ref: 'Agent' },
    toAgentId: { type: mongoose_1.Types.ObjectId, ref: 'Agent', required: true },
    reason: { type: String, enum: ['auto-assign', 'manual-reassign'], required: true },
    at: { type: Date, default: Date.now }
});
exports.AssignmentLog = (0, mongoose_1.model)('AssignmentLog', AssignmentLogSchema);
