// apps/web/src/pages/Tickets.tsx
import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import type { Ticket } from '../types';
import { me } from '../auth';
import Header from '../Components/Header';
import { Modal } from '../Components/Modal';

type Status = 'all' | 'open' | 'resolved' | 'unreachable';
type Sort = 'newest' | 'oldest';
type AgentLite = { id: string; name: string; externalUserId: string; isActive: boolean };

function StatusBadge({ status }: { status: Ticket['status'] }) {
  return (
    <span className={`badge ${status}`}>
      {status === 'open' ? 'Açık' : status === 'resolved' ? 'Çözümlendi' : 'Ulaşılamadı'}
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
      setAnchor({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: Math.max(220, r.width) });
    }
    setOpen((s) => !s);
  }

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
  const agentActive = !!assignedAgent?.isActive;

  const canReassign = isSuperAgent || (assignedToId && currentUserId && String(assignedToId) === String(currentUserId));

  const sender =
    it.telegram?.from?.displayName ||
    [it.telegram?.from?.firstName, it.telegram?.from?.lastName].filter(Boolean).join(' ') ||
    it.telegram?.from?.username ||
    'Bilinmiyor';
  const text = it.telegram?.text || '(Mesaj içeriği yok)';

  return (
    <div className="ticket">
      <div className={`card ticket-grid status-${it.status}`}>
          <div className="avatar-col">
          <div
            className={`status-dot ${agentActive ? 'filled' : ''} status-${it.status}`}
            title={assignedAgent ? `${assignedAgent.name} — ${agentActive ? 'Aktif' : 'Pasif'}` : it.telegram?.from?.username || ''}
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

          <div style={{ marginBottom: 10 }}>
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
          {/* Çözümlendi butonu her durumda aktif kalsın - yeniden mesaj/güncelleme gönderebilsinler */}
          <button onClick={() => onResolve(it)} className="btn primary">
            ✅ Çözümlendi
          </button>
          {/* Ulaşılamadı butonu sadece açık (open) olanlarda aktif olsun; çözümlendi olanlarda pasif */}
          <button onClick={() => onUnreachable(it.id)} disabled={it.status !== 'open'} className="btn danger">
            🚫 Ulaşılamadı
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
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // ajanları bir kere çek
  useEffect(() => {
    api<AgentLite[]>('/agents')
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);
function refresh() {
  setRefreshKey(k => k + 1);
}
  // listeyi çek
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('assignedTo', scopeMine ? 'me' : 'all');
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

    await api(`/tickets/${unreachableId}/unreachable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        resolutionText: raw,
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

  async function deleteTicket(id: string) {
    if (!confirm('Bu görevi silmek istediğine emin misin?')) return;
    try {
      await api(`/tickets/${id}`, { method: 'DELETE' });
      setPage((p) => p);
    } catch (e: any) {
      console.log('Silinemedi: ' + e.message);
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
    const defaultText = `Kullanıcıya ${topic} hakkında destek verildi. \n -${agentName}`;
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

    await api(`/tickets/${resolveId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionText: payload }),
    });

    setResolveOpen(false);
    setResolveId(undefined);
    setResolveText('');
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

  const pages = Math.max(1, Math.ceil(total / 10));
  const deletePermission = isSupervisor;
  // apply agent filter client-side for supervisors
  const filteredItems = agentFilter
    ? items.filter((it) => {
        const aid = typeof it.assignedTo === 'string' ? it.assignedTo : (it.assignedTo as any)?.id;
        return String(aid) === String(agentFilter);
      })
    : items;

  return (
    <>
      <Header />
      <div className="container">
        <h3 className="section-title">Görevler</h3>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="chips">
            {(['all', 'open', 'resolved', 'unreachable'] as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className={`chip ${status === s ? 'active' : ''}`}
              >
                {s === 'all' ? 'Tümü' : s === 'open' ? 'Açık' : s === 'resolved' ? 'Çözümlendi' : 'Ulaşılamadı'}
              </button>
            ))}
          </div>

          {/* view mode: list only (no box/list toggle) */}

          <div className="toggle" title="Kapsam">
            <button
              className={`seg-btn ${scopeMine ? 'active' : ''}`}
              onClick={() => {
                setScopeMine(true);
                setPage(1);
              }}
            >
              Benim
            </button>
            <button
              className={`seg-btn ${!scopeMine ? 'active' : ''}`}
              onClick={() => {
                setScopeMine(false);
                setPage(1);
              }}
              disabled={!isSupervisor}
            >
              Tümü
            </button>
          </div>

          <select
            className="select"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort);
              setPage(1);
            }}
          >
            <option value="newest">Sırala: Yeni → Eski</option>
            <option value="oldest">Sırala: Eski → Yeni</option>
          </select>

          <input
            className="input"
            placeholder="Ara isim, mesaj, agent"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <div className="spacer" />
          <div className="inline-muted">
            {items.length} / {total}
          </div>
        </div>

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
                  backgroundColor: 'var(--background)'
                }}
              />
            </div>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
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
                  backgroundColor: 'var(--background)'
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
