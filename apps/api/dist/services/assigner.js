"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignAgentForMessage = assignAgentForMessage;
const Agent_1 = require("../models/Agent");
const Rotation_1 = require("../models/Rotation");
// "Etiket: Değer" (satır sonuna kadar)
function getField(text, label = 'Ekstra') {
    if (!text)
        return;
    const m = text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'mi'));
    return m?.[1]?.trim();
}
// TR normalize
function norm(s) {
    return s.toLocaleLowerCase('tr-TR')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9ğüşöçı\s]+/gi, ' ')
        .replace(/\s+/g, ' ').trim();
}
// Ekstra içindeki isim agent.name içinde "kelime" olarak geçiyor mu?
function nameMatches(extra, agentName) {
    if (!agentName)
        return false;
    const e = norm(extra), a = norm(agentName);
    if (e.length < 2 || a.length < 2)
        return false;
    return a.split(' ').filter(Boolean).some(w => new RegExp(`(^|\\s)${w}(\\s|$)`, 'i').test(e));
}
// Aktif roster: extId!='1' küçük->büyük
async function getRoster() {
    const list = await Agent_1.Agent.find({ isActive: true }).lean();
    const filtered = list.filter(a => String(a.externalUserId) !== '1');
    filtered.sort((a, b) => Number(a.externalUserId) - Number(b.externalUserId));
    return filtered;
}
// Tüm ajanlar (aktif/pasif), extId!='1'
async function getAllAgentsExcludingOne() {
    const list = await Agent_1.Agent.find({}).lean();
    return list.filter(a => String(a.externalUserId) !== '1');
}
/**
 * Kural:
 * - Ekstra eşleşirse: HEMEN o ajana ata, rotasyona HİÇ dokunma (aynı döngüde sınırsız tekrar mümkün).
 * - Ekstra yoksa: Round-robin (aktif roster), her döngüde kişi başı 1.
 *   Döngü biterse assignedThisCycle = [] ve index kaldığı yerden adil ilerler.
 */
async function assignAgentForMessage(messageText) {
    // Rotasyon state (yoksa yarat)
    let rot = await Rotation_1.Rotation.findById('telegram');
    if (!rot)
        rot = await Rotation_1.Rotation.create({ _id: 'telegram', index: 0, cycle: 0, assignedThisCycle: [] });
    // 1) EKSTRA — rotasyona asla dokunma
    const extra = getField(messageText, 'Ekstra');
    if (extra && extra.trim().length > 1) {
        const everyone = await getAllAgentsExcludingOne(); // extId=1 hiçbir zaman atanmaz
        const target = everyone.find(a => nameMatches(extra, a.name));
        if (target) {
            return { id: String(target._id), name: target.name || target.externalUserId || 'Bilinmiyor' };
        }
    }
    // 2) NORMAL ROUND-ROBIN
    const roster = await getRoster(); // aktif & !='1'
    if (!roster.length)
        throw new Error('NO_ACTIVE_AGENT');
    // assignedThisCycle'ı roster'a göre temizle (aktif olmayanları düşür)
    const rosterIds = new Set(roster.map(a => String(a._id)));
    if (rot.assignedThisCycle?.length) {
        rot.assignedThisCycle = rot.assignedThisCycle.filter(id => rosterIds.has(id));
    }
    else {
        rot.assignedThisCycle = [];
    }
    const n = roster.length;
    // Eğer bozulma olmuşsa (ör. assignedThisCycle > n veya tümü doluysa), döngüyü doğru şekilde sıfırla
    if (rot.assignedThisCycle.length >= n) {
        rot.cycle += 1;
        rot.assignedThisCycle = [];
        // index'i olduğu yerden başlatacağız (başa sabitleme yok)
    }
    // Bu döngüde atanmamış ilk kişiyi, rot.index'ten başlayarak bul
    const start = rot.index % n;
    let pickIdx = -1;
    for (let step = 0; step < n; step++) {
        const i = (start + step) % n;
        const aid = String(roster[i]._id);
        if (!rot.assignedThisCycle.includes(aid)) {
            pickIdx = i;
            break;
        }
    }
    // Her ihtimale karşı (çok uç bir durumda) bulunamazsa, döngüyü sıfırla ve seç
    if (pickIdx === -1) {
        rot.cycle += 1;
        rot.assignedThisCycle = [];
        const i = rot.index % n; // adalet: kaldığın yerden başla
        const a = roster[i];
        rot.assignedThisCycle.push(String(a._id));
        rot.index = (i + 1) % n;
        await rot.save();
        return { id: String(a._id), name: a.name || a.externalUserId || 'Bilinmiyor' };
    }
    // Normal seçim: işaretle ve index'i seçilenin bir sonrasına al
    const a = roster[pickIdx];
    rot.assignedThisCycle.push(String(a._id));
    rot.index = (pickIdx + 1) % n;
    await rot.save();
    return { id: String(a._id), name: a.name || a.externalUserId || 'Bilinmiyor' };
}
