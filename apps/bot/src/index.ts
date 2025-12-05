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
  // Önce ILKSMS formatını kontrol et
  const uyeNoMatch = text?.match(/Üye\s+No\s*[:\-]?\s*(\d+)/i);
  const telefonMatch = text?.match(/Telefon\s*[:\-]?\s*([\d\s]+)/i);
  const konuMatch = text?.match(/Konu\s*[:\-]?\s*(.+)/i);
  const detayMatch = text?.match(/Detay\s*[:\-]?\s*(.+?)(?=\n-|$)/is);
  
  // ILKSMS formatı tespit edilirse, özel parse yap
  if (uyeNoMatch || (telefonMatch && konuMatch)) {
    return {
      id: uyeNoMatch?.[1]?.trim(),
      iletisim: telefonMatch?.[1]?.trim().replace(/\s/g, ''), // Boşlukları kaldır
      detay: (detayMatch?.[1] || konuMatch?.[1])?.trim(),
      proje: undefined,
      ekstra: undefined,
      isim: undefined
    };
  }
  
  // Standart formatı parse et
  return {
    id: pick(text, 'id |ID |Id|Üye No|uye no|Üye No'),
    iletisim: pick(text, 'İletisim|iletisim|iletişim|telefon|wp|whatsapp|İletişim|ıletişim|ıletısım|Telefon'),
    detay: pick(text, 'detay|Detay|Konu'),
    proje: pick(text, 'proje'),
    ekstra: pick(text, 'ekstra|isim|not'),
  };
}

function missingFields(p: Parsed): string[] {
  const miss: string[] = [];
  if (!p.id) miss.push('id |ID |Id|Üye No|uye no|');
  if (!p.iletisim) miss.push('İletisim');
  if (!p.detay) miss.push('detay');
  return miss;
}
// /start - agent eşleştirme akışı için bilgilendirme
bot.start(async (ctx) => {
  if (ctx.chat?.type !== 'private') return;

  const payloadRaw = (ctx.startPayload ?? '').trim();

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


// KOMUTLAR VE ÖZEL KELİMELER - mesaj handler'ından ÖNCE tanımlanmalı

// /myid command - send user's Telegram id
bot.command('myid', async (ctx) => {
  const userId = ctx.from?.id;
  console.log('[bot] /myid invoked', { chatType: ctx.chat?.type, fromId: ctx.from?.id, username: ctx.from?.username });
  if (!userId) {
    try { await ctx.reply("Kullanıcı id bulunamadı."); } catch (e) { console.warn('[bot] could not reply missing id', e); }
    return;
  }

  // If in private chat, reply directly with plain id (RawDataBot-style)
  if (ctx.chat?.type === 'private') {
    try {
      await ctx.reply(String(userId));
    } catch (e) {
      console.warn('[bot] failed to reply in private', e);
    }
    return;
  }

  // In group - try to DM the user and acknowledge in group
  try {
    await ctx.telegram.sendMessage(userId, String(userId));
    // short group acknowledgement
    await ctx.reply('Telegram id bilgisi özelden gönderildi.');
  } catch (e) {
    console.warn('[bot] failed to DM user for /myid', e);
    try { await ctx.reply(String(userId)); } catch (ex) { console.warn('[bot] failed to reply in group fallback', ex); }
  }
});

// /id command
bot.command('id', async (ctx) => {
  console.log('[bot] /id invoked', { chatType: ctx.chat?.type, fromId: ctx.from?.id });
  const userId = ctx.from?.id;
  if (!userId) {
    try { await ctx.reply("Kullanıcı id bulunamadı."); } catch (e) { console.warn('[bot] could not reply missing id', e); }
    return;
  }

  if (ctx.chat?.type === 'private') {
    try {
      await ctx.reply(String(userId));
      await ctx.reply(`/start aid-${String(userId)}`);
    } catch (e) {
      console.warn('[bot] failed to reply in private /id', e);
    }
    return;
  }

  try {
    await ctx.telegram.sendMessage(userId, String(userId));
    await ctx.telegram.sendMessage(userId, `/start aid-${String(userId)}`);
    await ctx.reply('Telegram id bilgisi özelden gönderildi.');
  } catch (e) {
    console.warn('[bot] failed to DM user for /id', e);
    try { await ctx.reply(String(userId)); } catch (ex) { console.warn('[bot] failed to reply in group fallback', ex); }
  }
});

// 'id' yazıldığında
bot.hears(/^\s*id\s*$/i, async (ctx) => {
  console.log('[bot] hears id', { chatType: ctx.chat?.type, fromId: ctx.from?.id });
  const userId = ctx.from?.id;
  if (!userId) return;

  // Özel sohbette direkt yanıtla
  if (ctx.chat?.type === 'private') {
    try {
      await ctx.reply(String(userId));
      await ctx.reply(`/start aid-${String(userId)}`);
    } catch (e) {
      console.warn('[bot] failed to reply to private id request', e);
    }
    return;
  }

  // Grup içindeyse DM atmayı dene, başarısız olursa grup içinde yanıt ver
  try {
    await ctx.telegram.sendMessage(userId, String(userId));
    await ctx.telegram.sendMessage(userId, `/start aid-${String(userId)}`);
    await ctx.reply('Telegram id bilgisi özelden gönderildi.');
  } catch (e) {
    console.warn('[bot] failed to DM user for hears id', e);
    try {
      await ctx.reply(String(userId));
    } catch (ex) {
      console.warn('[bot] failed to reply in group fallback', ex);
    }
  }
});

// Grup mesajlarını dinle (Privacy Mode OFF olmalı)
bot.on('message', async (ctx) => {
  // Sadece group/supergroup
  const type = ctx.chat?.type;
  if (type !== 'group' && type !== 'supergroup') {
    return; // Özel mesajları yok say
  }

  const text = ('text' in ctx.message) ? ctx.message.text : '';
  if (!text) return;

  // Mesajın gönderenini belirle - bot veya kullanıcı olabilir
  const senderId = ctx.from?.id;
  const isBot = ctx.from?.is_bot || false;
  
  // Bot mesajlarını da işle (başka bottan gelen talepler için)
  console.log('[bot] message received', { 
    chatType: type, 
    fromId: senderId, 
    isBot, 
    username: ctx.from?.username,
    textPreview: text.substring(0, 50) 
  });

  // Log kaydet - yardımcı fonksiyon
  const saveLog = async (level: string, event: string, data: any, message?: string) => {
    try {
      await fetch(`${env.API_BASE_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          event,
          data,
          message,
          chatId: String(ctx.chat?.id),
          messageId: ctx.message?.message_id,
          fromId: String(senderId),
          isBot
        })
      });
    } catch (e) {
      console.error('[bot] failed to save log', e);
    }
  };

  await saveLog('info', 'message_received', {
    chatType: type,
    fromId: senderId,
    isBot,
    username: ctx.from?.username,
    textLength: text.length
  });

  // Şablonu çöz
  const data = parseTemplate(text);
  const miss = missingFields(data);

  if (miss.length > 0) {
    await saveLog('warn', 'template_parse_failed', {
      missingFields: miss,
      textPreview: text.substring(0, 100)
    }, 'Şablon eksik alanlar içeriyor');

    // Bot mesajları için hata bildirimi gönderme (sadece kullanıcılar için)
    if (isBot) {
      console.log('[bot] skipping error notification for bot message', { fromId: senderId });
      return;
    }

    // Kullanıcıya özel mesajla bildir
    const userId = ctx.from?.id;
    const notifyText = miss.includes('id |ID |Id')
      ? 'id alanı zorunludur'
      : `Eksik alan(lar): ${miss.join(', ')}. Lütfen "id / iletisim / detay" alanlarını doldurun.`;

    const original = text || '(orijinal mesaj yok)';
    const finalDM = `${notifyText}\n\nOrijinal mesaj:\n${original}`;

    if (userId) {
      try {
        await ctx.telegram.sendMessage(userId, finalDM);
      } catch (e) {
        console.warn('[bot] failed to send error DM', e);
      }
    }
    return;
  }

  await saveLog('info', 'template_parsed', {
    parsedData: data
  }, 'Şablon başarıyla parse edildi');

  // Zorunlu alanlar tamam → API'ye ilet
  try {
    console.log('[bot] sending to API intake', { chatId: ctx.chat?.id, messageId: ctx.message?.message_id });
    const response = await fetch(`${env.API_BASE_URL}/bot/intake`, {
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

    if (response.ok) {
      console.log('[bot] successfully sent to API intake');
      await saveLog('info', 'api_intake_success', {
        responseStatus: response.status
      }, 'API intake başarılı');
    } else {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error('[bot] API intake failed', { status: response.status, error: errorText });
      await saveLog('error', 'api_intake_failed', {
        responseStatus: response.status,
        errorText
      }, 'API intake başarısız');
    }
  } catch (e) {
    console.error('[bot] failed to send to API intake', e);
    await saveLog('error', 'api_intake_exception', {
      error: String(e)
    }, 'API intake exception');
  }
});

// Inline butonlar
bot.on('callback_query', async (ctx) => {
  const data = ('data' in ctx.callbackQuery) ? String(ctx.callbackQuery.data) : '';
  const [kind, ticketId] = data.split(':');
  await ctx.answerCbQuery();
});

bot.launch().then(() => console.log('[bot] started'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
