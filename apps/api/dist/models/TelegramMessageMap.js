"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramMessageMap = void 0;
const mongoose_1 = require("mongoose");
const TelegramMessageMapSchema = new mongoose_1.Schema({
    ticketId: { type: mongoose_1.Types.ObjectId, ref: 'Ticket', required: true },
    announceMessageId: { type: Number },
});
exports.TelegramMessageMap = (0, mongoose_1.model)('TelegramMessageMap', TelegramMessageMapSchema);
