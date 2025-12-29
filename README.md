# telegramTodo – Monorepo Skeleton

React + Vite + TypeScript (web), Node.js + Express (api), Telegraf (bot), MongoDB.

## Hızlı Başlangıç

### ⚠️ ÖNEMLİ: Bot Ayarları (@BotFather)
Botun düzgün çalışması için **@BotFather** üzerinden şu ayarları yapmanız **zorunludur**:

#### 1. Botun Gruplara Katılmasını Aktifleştirin
```
@BotFather'a gidin
/mybots
Botunuzu seçin
Bot Settings → Allow Groups? → Turn groups on
```

#### 2. Group Privacy'yi Kapatın (Tüm mesajları görebilmesi için)
```
@BotFather'a gidin
/mybots
Botunuzu seçin
Bot Settings → Group Privacy → Turn off
```

**Açıklama:** 
- `Allow Groups: ON` - Bot gruplara katılabilir
- `Group Privacy: OFF` - Bot gruptaki TÜM mesajları okuyabilir (diğer botların mesajları dahil)
- `Group Privacy: ON` (varsayılan) - Bot SADECE kendisine mention olan veya komut içeren mesajları görür

**Kontrol:** Şu komutu çalıştırarak ayarları kontrol edebilirsiniz:
```powershell
$token = "BOT_TOKEN_BURAYA"
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getMe" | ConvertTo-Json
```

Çıktıda şunları görmelisiniz:
- `"can_join_groups": true`
- `"can_read_all_group_messages": true`

### Docker ile (Önerilen)
1. `.env.api` / `.env.bot` / `.env.web` dosyalarını `.example`'dan kopyalayın ve doldurun.
2. `docker compose build` ve `docker compose up -d` çalıştırın.
3. Vite dev: http://localhost:5173, API: http://localhost:8990/health

### Windows'ta Manuel (Development)
1. **Tüm servisleri başlatmak için:**
   ```
   start-all.bat
   ```
   Bu komut API, Bot ve Web'i ayrı terminal pencerelerinde başlatır.

2. **Tüm servisleri durdurmak için:**
   ```
   stop-all.bat
   ```

### PM2 ile (Production)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 logs
pm2 monit
```

## Otomatik Yeniden Başlatma

Sistem aşağıdaki durumlarda otomatik olarak yeniden başlar:
- Beklenmeyen hata (uncaughtException)
- Promise reddetme (unhandledRejection)
- Sunucu çökmesi

**Yeniden başlatma süresi:** 5 saniye
**ts-node-dev:** Kod değişikliklerinde otomatik yeniden yükleme

## Sistem Durumu Göstergesi

Web arayüzünde sağ üst köşede sistem durumu gösterilir:
- 🟢 **API:** Aktif/İnaktif
- 🟢 **Bot:** 10 saniyede bir ping kontrolü
- 🟢 **Database:** Bağlantı durumu

Sorun olduğunda otomatik yeniden başlatma bildirimi gösterilir.

## Health Check Endpoint

```
GET /health
```

Response:
```json
{
  "api": { "status": "up", "uptime": 3600 },
  "bot": { "status": "up", "lastPing": "2025-12-18T10:00:00Z" },
  "database": { "status": "up" }
}
```
