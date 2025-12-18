"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionKeyboard = actionKeyboard;
const telegraf_1 = require("telegraf");
function actionKeyboard(ticketId) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback('✅ Çözümlendi', `resolve:${ticketId}`),
            telegraf_1.Markup.button.callback('📵 Ulaşılamadı', `unreach:${ticketId}`)
        ]
    ]);
}
