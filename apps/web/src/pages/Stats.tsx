import { useEffect, useState } from 'react';
import { api } from '../api';
import Header from '../Components/Header';

export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'senders' | 'agents'>('senders');
  const [items, setItems] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    if (view === 'senders') {
      api('/tickets/stats/senders')
        .then((res) => setItems(res))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    } else {
      api('/tickets/stats/agents')
        .then((res) => setItems(res))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    // load agents map for matching senders to agent names
    api('/agents').then((res) => setAgents(res || [])).catch(() => setAgents([]));
  }, []);

  // refetch when view changes
  useEffect(() => {
    setLoading(true);
    if (view === 'senders') {
      api('/tickets/stats/senders')
        .then((res) => setItems(res))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    } else {
      api('/tickets/stats/agents')
        .then((res) => setItems(res))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
  }, [view]);

  const total = items.reduce((s, it) => s + (it.count || it.total || 0), 0) || 0;

  // helper: try to match sender name to agent
  function matchAgentByName(senderName: string) {
    if (!senderName) return null;
    const n = senderName.trim().toLowerCase();
    const found = agents.find((a) => String(a.name || '').trim().toLowerCase() === n);
    return found ? found.name : null;
  }

  return (
    <>
      <Header />
      <div className="container">
        <h3 className="section-title">İstatistikler — Gönderenler</h3>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="muted">Telegram üzerinden gelen taleplere göre istatistikler</div>
              <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                <button className={`chip ${view === 'senders' ? 'active' : ''}`} onClick={() => setView('senders')}>Temsilciler</button>
                <button className={`chip ${view === 'agents' ? 'active' : ''}`} onClick={() => setView('agents')}>Teknik</button>
              </div>
            </div>
            <div className="inline-muted">Toplam: {total}</div>
          </div>

          {loading ? (
            <div>Yükleniyor…</div>
          ) : items.length ? (
            view === 'senders' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
                {items.map((it) => {
                  const pct = Math.round(((it.count || 0) / Math.max(1, total)) * 100);
                  const matchedAgent = matchAgentByName(String(it.name || ''));
                  return (
                    <div key={`${String(it.id)}-${it.name}`} className="card" style={{ padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{it.name}</div>
                          {matchedAgent && <div className="inline-muted" style={{ marginTop: 6 }}>Eşleşen ajan: <strong>{matchedAgent}</strong></div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: 18 }}>{it.count}</div>
                          <div className="inline-muted">%{pct}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', height: 10, borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
                        </div>
                      </div>
                      {it.topProjects && it.topProjects.length ? (
                        <div style={{ marginTop: 10 }} className="inline-muted">
                          Projeler: {it.topProjects.map((p: any) => `${p.name} (${p.count})`).join(', ')}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {items.map((it) => (
                  <div key={it.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{it.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}><div className="inline-muted">Toplam</div><div style={{ fontWeight: 800 }}>{it.total}</div></div>
                      <div style={{ textAlign: 'center' }}><div className="inline-muted">Çözümlendi</div><div>{it.resolved}</div></div>
                      <div style={{ textAlign: 'center' }}><div className="inline-muted">Ulaşılamayan</div><div>{it.unreachable}</div></div>
                      <div style={{ textAlign: 'center' }}><div className="inline-muted">Açık</div><div>{it.open}</div></div>
                      <div style={{ textAlign: 'center' }}><div className="inline-muted">Yazılıma</div><div>{it.reported}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="muted">Veri yok</div>
          )}
        </div>
      </div>
    </>
  );
}
