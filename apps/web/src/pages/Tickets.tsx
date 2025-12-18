// apps/web/src/pages/Tickets.tsx
import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import type { Ticket } from '../types';
import { me } from '../auth';
import Header from '../Components/Header';
import { Modal } from '../Components/Modal';
import ChatModal from '../Components/ChatModal';

// Yanıp sönme animasyonu için style
const blinkStyle = document.createElement('style');
blinkStyle.textContent = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;
if (!document.head.querySelector('style[data-blink]')) {
  blinkStyle.setAttribute('data-blink', 'true');
  document.head.appendChild(blinkStyle);
}

type Status = 'all' | 'open' | 'resolved' | 'unreachable' | 'reported' | 'waiting';
type Sort = 'newest' | 'oldest';
type AgentLite = { id: string; name: string; externalUserId: string; isActive: boolean };

function StatusBadge({ status }: { status: Ticket['status'] }) {
  return (
    <span className={`badge ${status}`}>
      {status === 'open'
        ? 'Açık'
        : status === 'resolved'
        ? 'Çözümlendi'
        : status === 'unreachable'
        ? 'Ulaşılamadı'
        : status === 'reported'
        ? 'Yazılıma İletildi'
        : status === 'waiting'
        ? 'Üye Bekleniyor'
        : ''}
    </span>
  );
}

function highlight(text: string, term: string) {
  if (!term) return text;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i === -1) return text;
  const a = text.slice(0, i);
  const b = text.slice(i, i + term.length);
  const c = text.slice(i + term.length);
  return (
    <>
      {a}
      <span className="hl">{b}</span>
      {highlight(c, term)}
    </>
  );
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000),
    h = Math.floor(m / 60),
    d = Math.floor(h / 24);
  if (d > 0) return `${d}g önce`;
  if (h > 0) return `${h}s önce`;
  if (m > 0) return `${m}dk önce`;
  return 'az önce';
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// Custom agent dropdown used inside TicketCard to replace native select
function TicketAgentDropdown({
  ticketId,
  assignedToId,
  assignedToName,
  agents,
  onReassign,
  triggerLabel,
}: {
  ticketId: string;
  assignedToId: string | undefined;
  assignedToName?: string | undefined;
  agents: AgentLite[];
  onReassign: (ticketId: string, toAgentId: string) => void;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const trg = triggerRef.current;
      if (trg && !trg.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  function toggle() {
    const trg = triggerRef.current;
    if (trg) {
      const r = trg.getBoundingClientRect();
      // Use viewport coordinates because the menu is positioned fixed
      setAnchor({ top: r.bottom + 6, left: r.left, width: Math.max(220, r.width) });
    }
    setOpen((s) => !s);
  }

  // keep anchor updated while open so the fixed-position menu stays aligned with the trigger
  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      const trg = triggerRef.current;
      if (!trg) return;
      const r = trg.getBoundingClientRect();
      setAnchor({ top: r.bottom + 6, left: r.left, width: Math.max(220, r.width) });
    };
    const onResize = onScroll;
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    // initial align
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <>
      <div ref={triggerRef} className="agent-dropdown-trigger assigned-select" onClick={toggle} role="button" tabIndex={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>{triggerLabel}</div>
        </div>
      </div>

      {open && anchor && (
        <ul
          className="agent-dropdown-menu"
          style={{ top: anchor.top, left: anchor.left, minWidth: anchor.width, zIndex: 9999 }}
        >
          {agents
            .slice()
            .filter((a) => String(a.externalUserId) !== '1')
            .sort((a, b) => Number(a.externalUserId) - Number(b.externalUserId))
            .map((a) => (
              <li
                key={a.id}
                className="agent-dropdown-item"
                onClick={() => {
                  onReassign(ticketId, a.id);
                  setOpen(false);
                }}
              >
                <div className="avatar-sm" style={{ width: 28, height: 28, borderRadius: 8, fontWeight: 700 }}>{a.name?.[0]}</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 700 }}>{a.name}</div>
                  <div className="inline-muted" style={{ fontSize: 12 }}>{a.externalUserId}</div>
                </div>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

/** Kart bileşeni */
function TicketCard({
  it,
  query,
  onResolve,
  onUnreachable,
  onDelete,
  canDelete,
  agents,
  onReassign,
  onReport,
  // onNotify,
  onWaiting,
  onInterested,
  onChat,
  currentUserId,
  isSuperAgent,
}: {
  it: Ticket;
  query: string;
  onResolve: (t: Ticket) => void;
  onUnreachable: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  agents: AgentLite[];
  onReassign: (ticketId: string, toAgentId: string) => void;
  onReport: (ticketId: string) => void;
  // onNotify: (ticketId: string) => void;
  onWaiting: (ticketId: string) => void;
  onInterested: (ticketId: string) => void;
  onChat: (ticketId: string, userName: string) => void;
  currentUserId: string;
  isSuperAgent: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // normalize assignedTo for comparisons and display
  const assignedToId = typeof it.assignedTo === 'string' ? it.assignedTo : (it.assignedTo as any)?.id;
  const assignedToName = typeof it.assignedTo === 'string' ? undefined : (it.assignedTo as any)?.name;

  // find assigned agent from agents list to show online status
  const assignedAgent = agents.find(
    (a) => String(a.id) === String(assignedToId) || String(a.externalUserId) === String(assignedToId)
  );

  const canReassign = isSuperAgent || (assignedToId && currentUserId && String(assignedToId) === String(currentUserId));

  const sender =
    it.telegram?.from?.displayName ||
    [it.telegram?.from?.firstName, it.telegram?.from?.lastName].filter(Boolean).join(' ') ||
    it.telegram?.from?.username ||
    'Bilinmiyor';
  const text = it.telegram?.text || '(Mesaj içeriği yok)';

  // İletişim numarasını mesajdan çıkar
  function extractContact(text: string) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/\b(?:İletişim|İLETİŞİM|iletişim)[\s:]+(.+)$/i);
      if (match && match[1]) return match[1].trim();
    }
    return null;
  }

  const contactNumber = extractContact(text);

  // İlgilenme süresini hesapla: interestedAt ile çözümlenme zamanı arasındaki fark
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    // Sadece ticket open durumunda ve ilgilenilmişse sayaç çalışsın
    if (it.status !== 'open' || !it.interestedBy || !it.interestedAt) return;
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [it.status, it.interestedBy, it.interestedAt]);

  function getInterestedDuration() {
    if (!it.interestedBy || !it.interestedAt) return null;
    
    // Eğer ticket çözümlendiyse, interestedAt ile updatedAt arasındaki fark
    // Eğer hala açıksa, interestedAt ile şu anki zaman arasındaki fark
    const endTime = it.status === 'open' 
      ? currentTime 
      : (it.updatedAt ? new Date(it.updatedAt).getTime() : currentTime);
    
    const diff = endTime - new Date(it.interestedAt).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}g ${hours % 24}s ${minutes % 60}dk`;
    if (hours > 0) return `${hours}s ${minutes % 60}dk`;
    if (minutes > 0) return `${minutes}dk ${seconds % 60}sn`;
    return `${seconds}sn`;
  }

  const interestedDuration = getInterestedDuration();

  async function handleInterested() {
    if (contactNumber) {
      try {
        await navigator.clipboard.writeText(contactNumber);
      } catch (e) {
        console.error('Kopyalama başarısız:', e);
      }
    }
    onInterested(it.id);
  }

  return (
    <div className="ticket">
      <div className={`card ticket-grid status-${it.status}`}>
          <div className="avatar-col">
          <div
            // status-dot now reflects the ticket status (not agent activity)
            className={`status-dot filled status-${it.status}`}
            title={assignedAgent ? `${assignedAgent.name}` : it.telegram?.from?.username || ''}
          />
        </div>

        <div>
          <div className="card-head">
            <div className="sender"><span>Temsilci : </span>{sender}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="inline-muted">{timeAgo(it.assignedAt)}</span>
              <StatusBadge status={it.status} />
            </div>
          </div>

          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <strong style={{ marginRight: 8 }}>Atanan</strong>
            {it.status === 'resolved' || it.status === 'unreachable' || !canReassign ? (
              <div className="assigned-pill">
                <div className="assigned-name">{assignedToName || 'Atanmamış'}</div>
              </div>
            ) : (
              <TicketAgentDropdown
                ticketId={it.id}
                assignedToId={assignedToId}
                assignedToName={assignedToName}
                agents={agents}
                onReassign={onReassign}
                triggerLabel={assignedToName || 'Atanmamış'}
              />
            )}
                        {interestedDuration && (
              <div style={{ marginTop: 8, color: 'var(--accent)', fontWeight: 600 }}>
                ⏱️ İlgilenme süresi: {interestedDuration}
              </div>
            )}
          </div>

          <div className="msg">
            {highlight(text, query)}
            <div style={{ marginTop: 10, color: 'var(--muted)' }}>Çözüm Metni: {it.resolutionText ? it.resolutionText : 'Yok'}</div>

          </div>

          {text.length > 180 && (
            <div style={{ marginTop: 8 }}>
              <button
                className="chip small"
                onClick={(e: any) => {
                  const btn = e.currentTarget as HTMLElement;
                  setExpanded((prev) => {
                    const next = !prev;
                    const card = btn.closest('.card') as HTMLElement | null;
                    const msg = card?.querySelector('.msg') as HTMLElement | null;
                    if (msg) msg.style.maxHeight = next ? 'none' : '';
                    return next;
                  });
                }}
              >
                {expanded ? 'Gizle' : 'Devamını göster'}
              </button>
            </div>
          )}
        </div>

        <div className="actions-col">
          {/* İlgileniyorum butonu - en üstte */}
          <button 
            onClick={handleInterested} 
            className="btn" 
            disabled={!!it.interestedBy}
            style={{
              background: it.interestedBy ? 'var(--background-light)' : 'linear-gradient(90deg,#10b98122,#06b6d433)',
              cursor: it.interestedBy ? 'not-allowed' : 'pointer'
            }}
            title={contactNumber ? `İletişim: ${contactNumber}` : 'İletişim bilgisi bulunamadı'}
          >
            {it.interestedBy ? '✅ İlgileniliyor' : '👋 İlgileniyorum'}
          </button>
          
          {/* Çözümlendi butonu - sadece ilgilenildikten sonra aktif */}
          <button 
            onClick={() => onResolve(it)} 
            className="btn primary"
            disabled={!it.interestedBy}
            style={{
              cursor: !it.interestedBy ? 'not-allowed' : 'pointer',
              opacity: !it.interestedBy ? 0.5 : 1
            }}
          >
            ✅ Çözümlendi
          </button>
          {/* Ulaşılamadı butonu - sadece ilgilenildikten sonra ve açık olanlarda aktif */}
          <button 
            onClick={() => onUnreachable(it.id)} 
            disabled={!it.interestedBy || it.status !== 'open'} 
            className="btn danger"
            style={{
              cursor: !it.interestedBy || it.status !== 'open' ? 'not-allowed' : 'pointer',
              opacity: !it.interestedBy || it.status !== 'open' ? 0.5 : 1
            }}
          >
            🚫 Ulaşılamadı
          </button>
          {/* Yazılıma ilet butonu - sadece ilgilenildikten sonra aktif */}
          <button 
            onClick={() => onReport(it.id)} 
            className="btn" 
            disabled={!it.interestedBy || it.status === 'reported'} 
            style={{
              background:'linear-gradient(90deg,#7c3aed22,#2563eb11)',
              cursor: !it.interestedBy || it.status === 'reported' ? 'not-allowed' : 'pointer',
              opacity: !it.interestedBy || it.status === 'reported' ? 0.5 : 1
            }}
          >
            🛠️ Yazılıma İlet
          </button>
          {/* Üye Bekleniyor butonu - sadece ilgilenildikten sonra aktif */}
          <button 
            onClick={() => onWaiting(it.id)} 
            className="btn" 
            disabled={!it.interestedBy}
            style={{
              background:'linear-gradient(90deg,#f9731677,#f43f5e33)',
              cursor: !it.interestedBy ? 'not-allowed' : 'pointer',
              opacity: !it.interestedBy ? 0.5 : 1
            }}
          >
             ⏳Üye Bekleniy.
          </button>
          {/* Sohbet butonu - her zaman göster */}
          <button 
            onClick={() => {
              if (!it.telegram?.userChatId) {
                alert('Kullanıcı henüz bot\'a /start komutu göndermedi. Önce kullanıcının @' + (it.telegram?.from?.username || 'bot') + ' bot\'una /start göndermesi gerekiyor.');
                return;
              }
              onChat(it.id, it.telegram?.from?.username || it.telegram?.from?.firstName || 'Kullanıcı');
            }} 
            className="btn" 
            style={{
              background:'linear-gradient(90deg,#8b5cf622,#7c3aed33)',
              opacity: !it.telegram?.userChatId ? 0.6 : 1,
            }}
            title={!it.telegram?.userChatId ? 'Kullanıcı henüz bot\'a /start göndermedi' : 'Kullanıcı ile sohbet başlat'}
          >
            💬 Sohbet
          </button>
          {canDelete && (
            <button onClick={() => onDelete(it.id)} className="btn ghost" title="Bu görevi sil">
              🗑️ Sil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export default function Tickets() {
  const user = me();
  const isSupervisor = user?.role === 'supervisor';

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  // toolbar state
  const [status, setStatus] = useState<Status>('all');
  const [scopeMine, setScopeMine] = useState(user?.role !== 'supervisor');
  const [sort, setSort] = useState<Sort>('newest');
  const [q, setQ] = useState('');
  const qd = useDebounced(q, 250);
  const [agentFilter, setAgentFilter] = useState<string>('');

  // pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Ticket[]>([]);

  // agents (dropdown için) — HOOK içerde!
  const [agents, setAgents] = useState<AgentLite[]>([]);

  // determine if current user is special agent (1 or 1009) by looking up from agents list
  const currentAgent = agents.find((a) => a.id === user?.id);
  const effectiveIsSuperAgent = isSupervisor || !!(currentAgent && ['1', '1009'].includes(String(currentAgent.externalUserId)));

  // modal state
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveId, setResolveId] = useState<string | undefined>();
  const [resolveText, setResolveText] = useState('');
  const [unreachableOpen, setUnreachableOpen] = useState(false);
  const [unreachableId, setUnreachableId] = useState<string | undefined>();
  const [unreachableText, setUnreachableText] = useState('Ulaşılamadı wp üzerinden iletişime geçildi');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportId, setReportId] = useState<string | undefined>();
  const [reportText, setReportText] = useState('');
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // collapsible sidebar sections
  const [openDurum, setOpenDurum] = useState(true);
  const [openAgent, setOpenAgent] = useState(true);
  const [openKapsam, setOpenKapsam] = useState(true);
  const [openAra, setOpenAra] = useState(true);

  // Bildirimler için state'ler (useEffect'lerden önce tanımlanmalı)
  const [showInitialPopup, setShowInitialPopup] = useState(false);
  const [reportedCount, setReportedCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: 'reported' | 'waiting'; time: number }>>([]);
  const [lastCheckedReported, setLastCheckedReported] = useState<string[]>([]);
  const [lastCheckedWaiting, setLastCheckedWaiting] = useState<string[]>([]);
  const [lastTotalCount, setLastTotalCount] = useState<number | null>(null);

  // Chat modal state
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatTicketId, setChatTicketId] = useState<string | undefined>();
  const [chatUserName, setChatUserName] = useState<string>('');

  // Append agent signature to outgoing messages (not visible in textarea)
  function appendAgentSignature(raw: string) {
    const name = user?.name || 'Agent';
    const sig = ` -${name}`;
    if (!raw) return sig.trimStart();
    if (raw.trim().endsWith(sig)) return raw;
    return `${raw}\n${sig}`;
  }

  // ajanları bir kere çek
  useEffect(() => {
    api<AgentLite[]>('/agents')
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  // İlk girişte reported ve waiting ticket'ları kontrol et
  useEffect(() => {
    if (!user) return;
    const hasShownPopup = sessionStorage.getItem('hasShownInitialPopup');
    if (hasShownPopup) return;

    // Reported ve waiting ticket'ları çek (sadece bana atananlar)
    Promise.all([
      api<{ items: Ticket[] }>('/tickets?status=reported&assignedTo=me'),
      api<{ items: Ticket[] }>('/tickets?status=waiting&assignedTo=me')
    ]).then(([reportedRes, waitingRes]) => {
      const reportedTickets = reportedRes.items || [];
      const waitingTickets = waitingRes.items || [];
      
      setReportedCount(reportedTickets.length);
      setWaitingCount(waitingTickets.length);
      
      if (reportedTickets.length > 0 || waitingTickets.length > 0) {
        setShowInitialPopup(true);
        sessionStorage.setItem('hasShownInitialPopup', 'true');
      }
      
      // Son kontrol edilen ticket'ları kaydet
      setLastCheckedReported(reportedTickets.map(t => t.id));
      setLastCheckedWaiting(waitingTickets.map(t => t.id));
    }).catch(() => {});
  }, [user]);

  // Yeni reported/waiting ticket'ları 1 saat sonra bildir
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      Promise.all([
        api<{ items: Ticket[] }>('/tickets?status=reported&assignedTo=me'),
        api<{ items: Ticket[] }>('/tickets?status=waiting&assignedTo=me')
      ]).then(([reportedRes, waitingRes]) => {
        const reportedTickets = reportedRes.items || [];
        const waitingTickets = waitingRes.items || [];
        
        // Yeni reported ticket'ları bul
        const newReported = reportedTickets.filter(t => !lastCheckedReported.includes(t.id));
        // Yeni waiting ticket'ları bul
        const newWaiting = waitingTickets.filter(t => !lastCheckedWaiting.includes(t.id));
        
        const now = Date.now();
        const newNotifications: Array<{ id: string; type: 'reported' | 'waiting'; time: number }> = [];
        
        newReported.forEach(t => {
          newNotifications.push({ id: t.id, type: 'reported', time: now });
        });
        
        newWaiting.forEach(t => {
          newNotifications.push({ id: t.id, type: 'waiting', time: now });
        });
        
        if (newNotifications.length > 0) {
          setNotifications(prev => [...prev, ...newNotifications]);
        }
        
        setLastCheckedReported(reportedTickets.map(t => t.id));
        setLastCheckedWaiting(waitingTickets.map(t => t.id));
        setReportedCount(reportedTickets.length);
        setWaitingCount(waitingTickets.length);
      }).catch(() => {});
    }, 3600000); // 1 saat = 3600000ms
    
    return () => clearInterval(interval);
  }, [lastCheckedReported, lastCheckedWaiting, user]);

  // Yeni ticket kontrolü - her 10 saniyede bir toplam ticket sayısını kontrol et
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      // Tüm ticket'ları say (kime atandığına bakmadan)
      api<{ total: number }>('/tickets?assignedTo=all&page=1&limit=1')
        .then((res) => {
          if (lastTotalCount !== null && res.total > lastTotalCount) {
            // Yeni ticket geldi, sayfayı yenile
            refresh();
          }
          setLastTotalCount(res.total);
        })
        .catch(() => {});
    }, 60000); // 60 saniye
    
    return () => clearInterval(interval);
  }, [lastTotalCount, user]);

  // 1 saatten eski reported/waiting ticket'ları kontrol et
  useEffect(() => {
    if (!user) return;
    
    const checkOldTickets = () => {
      Promise.all([
        api<{ items: Ticket[] }>('/tickets?status=reported&assignedTo=me'),
        api<{ items: Ticket[] }>('/tickets?status=waiting&assignedTo=me')
      ]).then(([reportedRes, waitingRes]) => {
        const reportedTickets = reportedRes.items || [];
        const waitingTickets = waitingRes.items || [];
        
        const now = Date.now();
        const oneHourAgo = now - 3600000; // 1 saat önce
        
        // 1 saatten eski reported ticket'ları bul
        const oldReported = reportedTickets.filter(t => {
          const ticketTime = t.updatedAt ? new Date(t.updatedAt).getTime() : 
                            t.assignedAt ? new Date(t.assignedAt).getTime() : now;
          return ticketTime < oneHourAgo;
        });
        
        // 1 saatten eski waiting ticket'ları bul
        const oldWaiting = waitingTickets.filter(t => {
          const ticketTime = t.updatedAt ? new Date(t.updatedAt).getTime() : 
                            t.assignedAt ? new Date(t.assignedAt).getTime() : now;
          return ticketTime < oneHourAgo;
        });
        
        setNotifications(prev => {
          const oldNotifications: Array<{ id: string; type: 'reported' | 'waiting'; time: number }> = [];
          
          oldReported.forEach(t => {
            // Sadece daha önce bildirim gönderilmemiş olanları ekle
            if (!prev.find(n => n.id === t.id && n.type === 'reported')) {
              oldNotifications.push({ id: t.id, type: 'reported', time: now });
            }
          });
          
          oldWaiting.forEach(t => {
            // Sadece daha önce bildirim gönderilmemiş olanları ekle
            if (!prev.find(n => n.id === t.id && n.type === 'waiting')) {
              oldNotifications.push({ id: t.id, type: 'waiting', time: now });
            }
          });
          
          return oldNotifications.length > 0 ? [...prev, ...oldNotifications] : prev;
        });
      }).catch(() => {});
    };
    
    // İlk yüklemede kontrol et
    checkOldTickets();
    
    // Her 5 dakikada bir kontrol et
    const interval = setInterval(checkOldTickets, 300000); // 5 dakika = 300000ms
    
    return () => clearInterval(interval);
  }, [user]);

function refresh() {
  setRefreshKey(k => k + 1);
}
  // listeyi çek
  useEffect(() => {
    const params = new URLSearchParams();
    // If user selected the 'reported' filter, always show reported items from everyone
    if (status === 'reported') {
      params.set('assignedTo', 'all');
    } else {
      params.set('assignedTo', scopeMine ? 'me' : 'all');
    }
    if (status !== 'all') params.set('status', status);
    if (qd.trim()) params.set('q', qd.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sort', sort);

    setLoading(true);
    api<{ items: Ticket[]; page: number; limit: number; total: number; pages: number }>(`/tickets?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, scopeMine, sort, qd, page, limit, refreshKey]);

  // sayfa değişince en üste kaydır
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // actions
  async function unreachable(id: string) {
    setUnreachableId(id);
    setUnreachableOpen(true);
  }

  async function submitUnreachable() {
    if (!unreachableId) return;
    const raw = unreachableText.trim();
    if (!raw) return;

    let scheduleDateTime = null;
    if (scheduleDate && scheduleTime) {
      scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    const finalMsg = appendAgentSignature(raw);

    await api(`/tickets/${unreachableId}/unreachable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        resolutionText: finalMsg,
        scheduleDateTime: scheduleDateTime
      }),
    });

    setUnreachableOpen(false);
    setUnreachableId(undefined);
    setUnreachableText('Ulaşılamadı wp üzerinden iletişime geçildi');
    setScheduleDate('');
    setScheduleTime('');
    refresh();
  }

  function openReportModal(id: string) {
    setReportId(id);
    setReportText('Konu yazılım birimine iletilmiştir.');
    setReportOpen(true);
  }

  async function submitReport() {
    if (!reportId) {
      alert('Gönderecek kayıt seçili değil. Lütfen yeniden deneyin.');
      return;
    }
    const raw = reportText.trim();
    if (!raw) {
      alert('Lütfen iletilecek metni girin.');
      return;
    }

    const finalMsg = appendAgentSignature(raw);
    try {
      const res = await api(`/tickets/${reportId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionText: finalMsg }),
      });
      
    } catch (e) {
      // best-effort: if backend doesn't support /report, try a generic update
      try {
        const res2 = await api(`/tickets/${reportId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'reported', resolutionText: finalMsg }),
        });
       
      } catch (er) {
        // fallback PUT already attempted below; do not notify group or show alert per UX request
      }
    }

    setReportOpen(false);
    setReportId(undefined);
    setReportText('');
    refresh();
  }

  // Waiting (Üye Bekleniyor) modal
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [waitingId, setWaitingId] = useState<string | undefined>();
  const [waitingText, setWaitingText] = useState('Lütfen eksik bilgileri tamamlayınız.');

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; type?: 'success' | 'error' | 'info' }>>([]);
  function showToast(text: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }

  function openWaitingModal(id: string) {
    setWaitingId(id);
    setWaitingText('Lütfen eksik bilgileri tamamlayınız.');
    setWaitingOpen(true);
  }

  // Analysis modal after resolving a ticket
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisTicketId, setAnalysisTicketId] = useState<string | undefined>();
  const [analysisDifficulty, setAnalysisDifficulty] = useState<'easy'|'medium'|'hard'|''>('');
  const [analysisNote, setAnalysisNote] = useState('');

  function openAnalysisModalFor(id: string) {
    setAnalysisTicketId(id);
    setAnalysisDifficulty('');
    setAnalysisNote('');
    setAnalysisOpen(true);
  }

  async function submitAnalysis() {
    if (!analysisTicketId) return;
    try {
      await api(`/tickets/${analysisTicketId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: analysisDifficulty || undefined, note: analysisNote }),
      });
      setAnalysisOpen(false);
      setAnalysisTicketId(undefined);
      setAnalysisDifficulty('');
      setAnalysisNote('');
      showToast('Analiz kaydedildi', 'success');
      refresh();
    } catch (e) {
      showToast('Analiz kaydedilemedi', 'error');
    }
  }

  function openAnalysisModalFor(id: string) {
    setAnalysisTicketId(id);
    setAnalysisDifficulty('');
    setAnalysisNote('');
    setAnalysisOpen(true);
  }

  async function submitAnalysis() {
    if (!analysisTicketId) return;
    try {
      await api(`/tickets/${analysisTicketId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: analysisDifficulty || undefined, note: analysisNote }),
      });
      setAnalysisOpen(false);
      setAnalysisTicketId(undefined);
      setAnalysisDifficulty('');
      setAnalysisNote('');
      showToast('Analiz kaydedildi', 'success');
      refresh();
    } catch (e) {
      showToast('Analiz kaydedilemedi', 'error');
    }
  }

  async function submitWaiting() {
    if (!waitingId) return;
    const raw = waitingText.trim();
    if (!raw) {
      alert('Lütfen mesaj girin.');
      return;
    }

    try {
      await api(`/tickets/${waitingId}/waiting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: raw }),
      });
      showToast('Üye bekleniyor durumuna alındı', 'success');
      setWaitingOpen(false);
      setWaitingId(undefined);
      setWaitingText('');
      refresh();
    } catch (e) {
      showToast('Gönderilemedi', 'error');
      // keep modal open so agent can retry or edit
    }
  }

  async function deleteTicket(id: string) {
    if (!confirm('Bu görevi silmek istediğine emin misin?')) return;
    try {
      await api(`/tickets/${id}`, { method: 'DELETE' });
      setPage((p) => p);
    } catch (e: any) {
    }
  }

  function getField(text: string, label: string) {
    const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'mi');
    const m = text.match(re);
    return (m?.[1] || '').trim();
  }

  function openResolveModal(t: Ticket) {
    const agentName = user?.name || 'Agent';
    const raw = (t.telegram?.text || '').replace(/\r/g, '').trim();
    const detail = getField(raw, 'Detay');
    const topic = detail || '...';
    const defaultText = `Kullanıcıya ${topic} hakkında destek verildi.`;
    setResolveId(t.id);
    setResolveText(defaultText);
    setResolveOpen(true);
  }

  async function submitResolve() {
    if (!resolveId) return;
    const raw = resolveText.trim();
    const onlyDetail = getField(raw, 'Detay');
    const payload = (onlyDetail || raw).trim();
    if (!payload) return;

    const finalMsg = appendAgentSignature(payload);

    await api(`/tickets/${resolveId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionText: finalMsg }),
    });

    setResolveOpen(false);
    setResolveText('');
    // after resolving, open analysis modal so agent can rate difficulty / add note
    openAnalysisModalFor(resolveId);
    setResolveId(undefined);
    setPage((p) => p); // refresh
    refresh();
  }

  async function onReassign(ticketId: string, toAgentId: string) {
    if (!toAgentId) return;
    try {
      await api(`/tickets/${ticketId}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ toAgentId }),
      });
      refresh();
    } catch (e: any) {
      alert('Atama değiştirilemedi: ' + (e?.message || 'hata'));
    }
    
  }

  async function onInterested(ticketId: string) {
    try {
      await api(`/tickets/${ticketId}/interested`, {
        method: 'POST',
      });
      showToast('İlgileniyorum işaretlendi', 'success');
      refresh();
    } catch (e: any) {
      showToast('İşlem başarısız', 'error');
    }
  }

  const pages = Math.max(1, Math.ceil(total / 10));
  const deletePermission = isSupervisor;
  // build client-side visible list as a safety-net in case backend doesn't fully filter
  let visibleItems = items.slice();
  // apply status filter client-side (ensures 'reported' shows only reported tickets)
  if (status !== 'all') {
    visibleItems = visibleItems.filter((it) => String(it.status) === String(status));
  }
  // apply agent filter client-side for supervisors
  const filteredItems = agentFilter
    ? visibleItems.filter((it) => {
        const aid = typeof it.assignedTo === 'string' ? it.assignedTo : (it.assignedTo as any)?.id;
        return String(aid) === String(agentFilter);
      })
    : visibleItems;

  return (
    <>
      <Header />
      {/* Toast container */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type || 'info'}`}>
            {t.text}
          </div>
        ))}
      </div>
      
      {/* Bildirim badge'leri - sağ üst köşe */}
      {notifications.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {notifications.filter(n => n.type === 'reported').length > 0 && (
            <div 
              className="notification-badge blink"
              onClick={() => {
                setStatus('reported');
                setNotifications(prev => prev.filter(n => n.type !== 'reported'));
              }}
              style={{
                backgroundColor: '#7c3aed',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
                animation: 'blink 1.5s infinite'
              }}
            >
              🛠️ Yazılıma iletilmiş {notifications.filter(n => n.type === 'reported').length} konu var
            </div>
          )}
          {notifications.filter(n => n.type === 'waiting').length > 0 && (
            <div 
              className="notification-badge blink"
              onClick={() => {
                setStatus('waiting');
                setNotifications(prev => prev.filter(n => n.type !== 'waiting'));
              }}
              style={{
                backgroundColor: '#f97316',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)',
                animation: 'blink 1.5s infinite'
              }}
            >
              ⏳ Üye bekleyen {notifications.filter(n => n.type === 'waiting').length} konu var
            </div>
          )}
        </div>
      )}
      
      {/* İlk giriş popup'u */}
      <Modal open={showInitialPopup} title="Bekleyen Konular" onClose={() => setShowInitialPopup(false)}>
        <div style={{ marginBottom: '16px' }}>
          {reportedCount > 0 && (
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'rgba(124, 58, 237, 0.1)', 
              borderRadius: '8px', 
              marginBottom: '12px',
              borderLeft: '4px solid #7c3aed'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>🛠️ Yazılıma İletilen Konular</div>
              <div>{reportedCount} adet yazılıma iletilen konu bulunmaktadır.</div>
            </div>
          )}
          {waitingCount > 0 && (
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'rgba(249, 115, 22, 0.1)', 
              borderRadius: '8px',
              borderLeft: '4px solid #f97316'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>⏳ Üye Bekleniyor</div>
              <div>{waitingCount} adet üye bekleniyor durumunda konu bulunmaktadır.</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setShowInitialPopup(false)}>
            Tamam
          </button>
        </div>
      </Modal>
      
      <div className="container">
        <h3 className="section-title">Görevler</h3>

        <div className="layout">
          <aside className="sidebar">
            <div style={{ marginBottom: 12, fontWeight: 800 }}>Filtreler</div>
            <div className={`filter-section ${openAra ? 'open' : ''}`}>
              <div className="filter-header" onClick={() => setOpenAra((v) => !v)} role="button" tabIndex={0}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Ara</div>
                <div className={`chev ${openAra ? 'open' : ''}`} />
              </div>
              <div className="filter-content" style={{ display: openAra ? 'block' : 'none' }}>
                <input className="input" placeholder="Ara isim, mesaj, agent" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              </div>
            </div>
            <div className={`filter-section ${openDurum ? 'open' : ''}`}>
              <div className="filter-header" onClick={() => setOpenDurum((v) => !v)} role="button" tabIndex={0}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Durum</div>
                <div className={`chev ${openDurum ? 'open' : ''}`} />
              </div>
              <div className="filter-content" style={{ display: openDurum ? 'block' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(['all', 'open', 'resolved', 'unreachable', 'reported', 'waiting'] as Status[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatus(s);
                        setPage(1);
                      }}
                      className={`chip ${status === s ? 'active' : ''} ${s === 'reported' ? 'chip--reported' : ''}`}
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                    >
                      {s === 'all'
                        ? 'Tümü'
                        : s === 'open'
                        ? 'Açık'
                        : s === 'resolved'
                        ? 'Çözümlendi'
                        : s === 'reported'
                        ? 'Yazılıma İletildi'
                        : s === 'waiting'
                        ? 'Üye Bekleniyor'
                        : 'Ulaşılamadı'
                        }
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`filter-section ${openAgent ? 'open' : ''}`}>
              <div className="filter-header" onClick={() => setOpenAgent((v) => !v)} role="button" tabIndex={0}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Agent</div>
                <div className={`chev ${openAgent ? 'open' : ''}`} />
              </div>
              <div className="filter-content" style={{ display: openAgent ? 'block' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className={`chip ${!agentFilter ? 'active' : ''}`} onClick={() => setAgentFilter('')}>Tümü</button>
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAgentFilter(a.id)}
                      className={`chip ${String(agentFilter) === String(a.id) ? 'active' : ''}`}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar-sm">{a.name?.[0]}</div>
                        <div style={{ fontWeight: 700 }}>{a.name}</div>
                      </div>
                      <div className="inline-muted">{a.externalUserId}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`filter-section ${openKapsam ? 'open' : ''}`}>
              <div className="filter-header" onClick={() => setOpenKapsam((v) => !v)} role="button" tabIndex={0}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Kapsam</div>
                <div className={`chev ${openKapsam ? 'open' : ''}`} />
              </div>
              <div className="filter-content" style={{ display: openKapsam ? 'block' : 'none' }}>
                <div className="toggle" style={{ width: '100%' }}>
                  <button className={`seg-btn ${scopeMine ? 'active' : ''}`} onClick={() => { setScopeMine(true); setPage(1); }}>Benim</button>
                  <button className={`seg-btn ${!scopeMine ? 'active' : ''}`} onClick={() => { setScopeMine(false); setPage(1); }} disabled={!isSupervisor}>Tümü</button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="inline-muted">{items.length} / {total}</div>
                <select className="select" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(1); }}>
                  <option value="newest">Yeni → Eski</option>
                  <option value="oldest">Eski → Yeni</option>
                </select>
              </div>
            </div>
          </aside>

          <main className="main">

        {/* Sonuçlar (list view only) */}
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div className="card" key={i}>
                <div className="skel skel-line" style={{ width: '28%' }} />
                <div className="skel" style={{ height: 70, marginTop: 10 }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <div className="skel" style={{ width: 120, height: 36 }} />
                  <div className="skel" style={{ width: 120, height: 36 }} />
                </div>
              </div>
            ))}
          </>
        ) : filteredItems.length ? (
          filteredItems.map((it) => (
            <div key={it.id} style={{ marginBottom: 14 }}>
              <TicketCard
                it={it}
                query={qd}
                onResolve={openResolveModal}
                onUnreachable={unreachable}
                onDelete={deleteTicket}
                canDelete={deletePermission}
                agents={agents}
                onReassign={onReassign}
                onReport={openReportModal}
                onWaiting={openWaitingModal}
                onInterested={onInterested}
                onChat={(ticketId, userName) => {
                  setChatTicketId(ticketId);
                  setChatUserName(userName);
                  setChatModalOpen(true);
                }}
                currentUserId={user?.id || ''}
                isSuperAgent={effectiveIsSuperAgent}
              />
            </div>
          ))
        ) : (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Sonuç bulunamadı
          </div>
        )}

        {/* Sayfalama */}
        {!loading && total > 0 && <Pagination page={page} pages={pages} onPage={setPage} />}
          </main>
        </div>
      </div>

      {/* Çözümlendi Modal */}
      <Modal open={resolveOpen} title="Çözümlendi" onClose={() => setResolveOpen(false)}>
        <div className="muted">Metni düzenleyebilir, gerekirse detay ekleyebilirsin.</div>
        <textarea value={resolveText} onChange={(e) => setResolveText(e.target.value)} />
        <div className="row">
          <button className="btn btn-secondary" onClick={() => setResolveOpen(false)}>
            İptal
          </button>
          <button className="btn btn-success" onClick={submitResolve}>
            Gönder
          </button>
        </div>
      </Modal>
      <Modal open={unreachableOpen} title="Ulaşılamadı" onClose={() => setUnreachableOpen(false)}>
        <div style={{ 
          backgroundColor: 'var(--background-light)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <div className="muted" style={{ marginBottom: '1rem' }}>Gruba Gönderilecek Mesaj</div>
          <textarea 
            value={unreachableText} 
            onChange={(e) => setUnreachableText(e.target.value)}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--background)',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ 
          backgroundColor: 'var(--background-light)',
          padding: '1.5rem',
          borderRadius: '8px'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <div className="muted" style={{ marginBottom: '0.5rem' }}>
              Bot'un Size Mesaj Göndereceği Zaman
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Seçtiğiniz saatte bot size hatırlatma mesajı gönderecektir
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '1rem',
            marginBottom: '0.5rem'
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
              }}>
                Tarih
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: 'var(--text)'
              }}>
                Saat
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--text)'
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '1rem', 
          marginTop: '1.5rem'
        }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setUnreachableOpen(false)}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '6px'
            }}
          >
            İptal
          </button>
          <button 
            className="btn btn-success" 
            onClick={submitUnreachable}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '6px'
            }}
          >
            Kaydet ve Gönder
          </button>
        </div>
      </Modal>
      {/* Yazılıma İlet Modal */}
      <Modal open={reportOpen} title="Yazılıma İlet" onClose={() => setReportOpen(false)}>
        <div className="muted">Konu hakkında yazılıma iletilecek mesajı girin.</div>
        <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setReportOpen(false)}>
            İptal
          </button>
          <button className="btn btn-success" onClick={submitReport}>
            Gönder
          </button>
        </div>
      </Modal>
      {/* Kullanıcıyı Uyar Modal */}
      {/* <Modal open={notifyOpen} title="Kullanıcıyı Uyar" onClose={() => setNotifyOpen(false)}>
        <div className="muted">Kullanıcıya gönderilecek özel mesajı düzenleyin.</div>
        <textarea value={notifyText} onChange={(e) => setNotifyText(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setNotifyOpen(false)}>
            İptal
          </button>
          <button className="btn btn-success" onClick={submitNotify}>
            Gönder
          </button>
        </div>
      </Modal> */}

      {/* Üye Bekleniyor Modal */}
      <Modal open={waitingOpen} title="Üye Bekleniyor" onClose={() => setWaitingOpen(false)}>
        <div className="muted">Kullanıcıya gönderilecek mesajı düzenleyin.</div>
        <textarea value={waitingText} onChange={(e) => setWaitingText(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setWaitingOpen(false)}>
            İptal
          </button>
          <button className="btn btn-success" onClick={submitWaiting}>
            Gönder
          </button>
        </div>
      </Modal>

      {/* Analiz Modal (çözümlendikten sonra açılır) */}
      {analysisOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h4>Analiz - Talep Zorluğu ve Not</h4>
            <div style={{ marginBottom: 8 }}>
              <label className="inline-muted">Zorluk</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button className={`chip ${analysisDifficulty === 'easy' ? 'active' : ''}`} onClick={() => setAnalysisDifficulty('easy')}>Kolay</button>
                <button className={`chip ${analysisDifficulty === 'medium' ? 'active' : ''}`} onClick={() => setAnalysisDifficulty('medium')}>Orta</button>
                <button className={`chip ${analysisDifficulty === 'hard' ? 'active' : ''}`} onClick={() => setAnalysisDifficulty('hard')}>Zor</button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="inline-muted">Not</label>
              <textarea value={analysisNote} onChange={(e) => setAnalysisNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setAnalysisOpen(false)}>Atla</button>
              <button className="btn btn-success" onClick={submitAnalysis}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatModalOpen && (
        <ChatModal 
          ticketId={chatTicketId!}
          userName={chatUserName}
          onClose={() => setChatModalOpen(false)}
        />
      )}
    </>
  );
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const prev = () => onPage(Math.max(1, page - 1));
  const next = () => onPage(Math.min(pages, page + 1));

  const nums: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '16px 0' }}>
      <button className="chip" onClick={prev} disabled={page === 1}>
        ‹ Önceki
      </button>
      {start > 1 && <span className="inline-muted">…</span>}
      {nums.map((n) => (
        <button key={n} className={`chip ${n === page ? 'active' : ''}`} onClick={() => onPage(n)}>
          {n}
        </button>
      ))}
      {end < pages && <span className="inline-muted">…</span>}
      <button className="chip" onClick={next} disabled={page === pages}>
        Sonraki ›
      </button>
    </div>
  );
}
