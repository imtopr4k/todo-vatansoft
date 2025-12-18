import { Markup } from 'telegraf';

export function actionKeyboard(ticketId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Çözümlendi', `resolve:${ticketId}`),
      Markup.button.callback('📵 Ulaşılamadı', `unreach:${ticketId}`)
    ]
  ]);
}
