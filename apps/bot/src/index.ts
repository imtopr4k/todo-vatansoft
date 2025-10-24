import { Telegraf } from 'telegraf';
import { env } from './env';
import { actionKeyboard } from './keyboards';
import { createTicketAndAssign, markResolved, markUnreachable } from './apiClient';

const bot = new Telegraf(env.BOT_TOKEN);
type Parsed = {
  id?: string;
  iletisim?: string;
  detay?: string;
  proje?: string;
  ekstra?: string;
  isim?: string;
};

function pick(text: string | undefined, labels: string | string[]): string | undefined {
  if (!text) return;
  const list = Array.isArray(labels) ? labels : labels.split('|');

  // Örn: ^\s*(iletişim|iletisim|telefon|wp|whatsapp)\s*[.:：\-]?\s*(.+)$
  const pattern = `^\\s*(?:${list.join('|')})\\s*[\\.:：\\-]?\\s*(.+)$`;
  const re = new RegExp(pattern, 'gmiu'); // g,m,i,**u (Unicode)**

  let match: RegExpExecArray | null;
  // Satır satır tara (çok satırlı metinlerde güvenli)
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    re.lastIndex = 0;
    match = re.exec(line);
    if (match?.[1]) return match[1].trim();
  }
  return;
}

function parseTemplate(text?: string): Parsed {
  return {
    id: pick(text, 'id'),
    iletisim: pick(text, 'iletisim|iletişim|telefon|wp|whatsapp|İletişim'),
    detay: pick(text, 'detay'),
    proje: pick(text, 'proje'),
    ekstra: pick(text, 'ekstra|isim|not'),
  };
}

function missingFields(p: Parsed): string[] {
  const miss: string[] = [];
  if (!p.id) miss.push('id');
  if (!p.iletisim) miss.push('iletisim');
  if (!p.detay) miss.push('detay');
  return miss;
}
// /start - agent eşleştirme akışı için bilgilendirme
bot.start(async (ctx) => {
  if (ctx.chat?.type !== 'private') return;

  const payloadRaw = (ctx.startPayload ?? '').trim();
  console.log('[BOT] /start payload =', payloadRaw); // ➜ terminalde gör

  // aid-xxxxx veya aid_xxxxx kabul et; 24 hex şartını kaldıralım
  const m = payloadRaw.match(/^aid[-_](.+)$/i);
  if (!m) {
    return ctx.reply('Merhaba! Uygulamadaki "Telegram eşleştir" butonundan gelmen gerekiyor.\n' +
      'Olmazsa şu komutu sohbetimize elle gönder:\n\n`/start aid-<AJAN_ID>`', { parse_mode: 'Markdown' });
  }

  const agentId = m[1];                         // Mongo ObjectId veya backend’in kullandığı id
  const telegramUserId = String(ctx.from?.id);

  try {
    const res = await fetch(`${env.API_BASE_URL}/bot/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, telegramUserId })
    });
    if (!res.ok) throw new Error(await res.text());
    return ctx.reply('Eşleştirme başarılı! Artık görev bildirimleri için hazırsın.');
  } catch (e: any) {
    return ctx.reply('Eşleştirme başarısız: ' + (e?.message || 'hata'));
  }
});


// Grup mesajlarını dinle (Privacy Mode OFF olmalı)
bot.on('message', async (ctx) => {
  // Sadece group/supergroup
  const type = ctx.chat?.type;
  if (type !== 'group' && type !== 'supergroup') {
    // İstersen tamamen sessiz kal:
    // return;
    // veya nazikçe:
    // return ctx.reply('Lütfen grupta şablona göre yazın. Özel mesajlar işlenmiyor.');
    return; // tamamen yok sayıyoruz
  }

  const text = ctx.message?.text || '';
  if (!text) return;

  // Şablonu çöz
  const data = parseTemplate(text);
  const miss = missingFields(data);

  if (miss.length > 0) {
    // Özellikle 'id' yoksa istenen mesajı ver
    if (miss.includes('id')) {
      return ctx.reply('*id alanı zorunludur*', {
        parse_mode: 'Markdown',
        reply_to_message_id: ctx.message?.message_id
      });
    }
    // Diğer eksikler için kibar özet
    return ctx.reply(
      `Eksik alan(lar): ${miss.join(', ')}. Lütfen "id / iletisim / detay" alanlarını doldurun.`,
      { reply_to_message_id: ctx.message?.message_id }
    );
  }

  // Zorunlu alanlar tamam → API'ye ilet (burada HENÜZ atama yapma niyetini değiştirmediysen,
  // mevcut intake rotanı çağırmaya devam edebilirsin; sen "dağıtım yapmayacak" dediysen
  // sadece kayıt/loglamak istiyorsan, ilgili API'ye karar ver)
  try {
    await fetch(`${env.API_BASE_URL}/bot/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: ctx.chat?.id,
        messageId: ctx.message?.message_id,
        text,
        from: {
          id: ctx.from?.id,
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name
        }
      })
    });
    // Not: Atama ve “Görev X’e atandı” mesajı API tarafında zaten reply olarak atılıyorsa
    // burada ayrıca bir mesaj göndermiyoruz.
  } catch (e) {
    // sessiz geçebilir veya hata loglayabilirsin
  }
});

// Inline butonlar
bot.on('callback_query', async (ctx) => {
  const data = String(ctx.callbackQuery?.data || '');
  const [kind, ticketId] = data.split(':');
  await ctx.answerCbQuery();
});

bot.launch().then(() => console.log('[bot] started'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
