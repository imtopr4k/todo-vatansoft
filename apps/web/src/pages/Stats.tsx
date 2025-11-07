import { useEffect, useState } from 'react';
import { api } from '../api';
import Header from '../Components/Header';

export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'senders' | 'agents'>('senders');
  const [items, setItems] = useState<any[]>([]);

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

  const total = items.reduce((s, it) => s + it.count, 0) || 0;

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
                <button className={`chip ${view === 'senders' ? 'active' : ''}`} onClick={() => setView('senders')}>Temsilci</button>
                <button className={`chip ${view === 'agents' ? 'active' : ''}`} onClick={() => setView('agents')}>Agent</button>
              </div>
            </div>
            <div className="inline-muted">Toplam: {total}</div>
          </div>

          {loading ? (
            <div>Yükleniyor…</div>
          ) : items.length ? (
            view === 'senders' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {items.map((it) => (
                  <div key={`${String(it.id)}-${it.name}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 220 }}>
                      <div style={{ fontWeight: 700 }}>{it.name}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', height: 14, borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round((it.count / Math.max(1, total)) * 100)}%`, background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
                      </div>
                    </div>
                    <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 700 }}>{it.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 6px' }}>Agent</th>
                    <th style={{ padding: '8px 6px' }}>Toplam</th>
                    <th style={{ padding: '8px 6px' }}>Çözümlendi</th>
                    <th style={{ padding: '8px 6px' }}>Ulaşılamayan</th>
                    <th style={{ padding: '8px 6px' }}>Açık</th>
                    <th style={{ padding: '8px 6px' }}>Yazılıma</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 6px' }}>{it.name}</td>
                      <td style={{ padding: '10px 6px', fontWeight: 700 }}>{it.total}</td>
                      <td style={{ padding: '10px 6px' }}>{it.resolved}</td>
                      <td style={{ padding: '10px 6px' }}>{it.unreachable}</td>
                      <td style={{ padding: '10px 6px' }}>{it.open}</td>
                      <td style={{ padding: '10px 6px' }}>{it.reported}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div className="muted">Veri yok</div>
          )}
        </div>
      </div>
    </>
  );
}
