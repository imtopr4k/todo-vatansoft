// apps/web/src/pages/Tickets.tsx
import { useEffect, useState } from 'react';
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

/** Kart bileşeni */
function TicketCard({
  it,
  query,
  onResolve,
  onUnreachable,
  onDelete,
  canDelete,
  canReassign,
  agents,
  onReassign,
}: {
  it: Ticket;
  query: string;
  onResolve: (t: Ticket) => void;
  onUnreachable: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  canReassign: boolean;
  agents: AgentLite[];
  onReassign: (ticketId: string, toAgentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const sender =
    it.telegram?.from?.displayName ||
    [it.telegram?.from?.firstName, it.telegram?.from?.lastName].filter(Boolean).join(' ') ||
    it.telegram?.from?.username ||
    'Bilinmiyor';
  const text = it.telegram?.text || '(Mesaj içeriği yok)';

  return (
    <div className="card">
      <div className="card-head">
        <div className="sender">{sender}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="inline-muted">{timeAgo(it.assignedAt)}</span>
          <StatusBadge status={it.status} />
        </div>
      </div>

      <div className="msg">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <strong>Atanan:</strong>
          {(
            it.status === 'resolved' || it.status === 'unreachable' ? it.assignedTo?.name || 'Atanmamış':
            <div style={{ marginLeft: 12 }}>
              <select
                value={it.assignedTo || ''}
                onChange={(e) => onReassign(it.id, e.target.value)}
                className="select"
              >
                <option value="">{it.assignedTo?.name || 'Atanmamış'}</option>
                {agents
                  .slice()
                  .sort((a, b) => Number(a.externalUserId) - Number(b.externalUserId))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.isActive ? '● ' : '○ '}
                      {a.name} ({a.externalUserId})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {highlight(text, query)}
        <br />
        <span>Çözüm Metni: {it.resolutionText ? it.resolutionText : 'Yok'}</span>
      </div>

      {text.length > 180 && (
        <div style={{ marginTop: 6 }}>
          <button
            className="chip"
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

      <div className="card-actions">
        <button onClick={() => onResolve(it)} disabled={it.status !== 'open' && it.status !== 'unreachable'} className="btn btn-success">
          ✅ Çözümlendi
        </button>

        <button onClick={() => onUnreachable(it.id)} disabled={it.status !== 'open'} className="btn btn-danger">
          🚫 Ulaşılamadı
        </button>

        {canDelete && (
          <button
            onClick={() => onDelete(it.id)}
            className="btn"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            title="Bu görevi sil"
          >
            🗑️ Sil
          </button>
        )}
      </div>
    </div>
  );
}

export default function Tickets() {
  const user = me();
  const isSupervisor = user?.role === 'supervisor';
  const canReassign = ['1', '1009'].includes(String(user?.externalUserId || ''));

  const [loading, setLoading] = useState(true);
const [refreshKey, setRefreshKey] = useState(0);
  // toolbar state
  const [status, setStatus] = useState<Status>('all');
  const [scopeMine, setScopeMine] = useState(user?.role !== 'supervisor');
  const [sort, setSort] = useState<Sort>('newest');
  const [q, setQ] = useState('');
  const qd = useDebounced(q, 250);

  // pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Ticket[]>([]);

  // agents (dropdown için) — HOOK içerde!
  const [agents, setAgents] = useState<AgentLite[]>([]);

  // modal state
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveId, setResolveId] = useState<string | undefined>();
  const [resolveText, setResolveText] = useState('');

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
    await api(`/tickets/${id}/unreachable`, { method: 'POST' });
    setPage((p) => p);
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

          <div className="toggle" title="Kapsam">
            <button
              className={scopeMine ? 'active' : ''}
              onClick={() => {
                setScopeMine(true);
                setPage(1);
              }}
            >
              Benim
            </button>
            <button
              className={!scopeMine ? 'active' : ''}
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

        {/* Sonuçlar */}
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
        ) : items.length ? (
          items.map((it) => (
            <TicketCard
              key={it.id}
              it={it}
              query={qd}
              onResolve={openResolveModal}
              onUnreachable={unreachable}
              onDelete={deleteTicket}
              canDelete={deletePermission}
              canReassign={canReassign}
              agents={agents}
              onReassign={onReassign}
            />
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
