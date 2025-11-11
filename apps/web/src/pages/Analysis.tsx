import { useEffect, useState } from 'react';
import Header from '../Components/Header';
import { api } from '../api';
import { me } from '../auth';

type AgentLite = { id: string; name: string; externalUserId: string };

export default function Analysis() {
  const user = me();
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [agent, setAgent] = useState<string>('');
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [onlyAnalyzed, setOnlyAnalyzed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTicketId, setModalTicketId] = useState<string | null>(null);
  const [modalDifficulty, setModalDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [modalNote, setModalNote] = useState('');

  useEffect(() => {
    api<AgentLite[]>('/agents').then(setAgents).catch(() => setAgents([]));
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (agent) qs.set('agentId', agent);
      if (difficultyFilter) qs.set('difficulty', difficultyFilter);
      if (onlyAnalyzed) qs.set('onlyAnalyzed', 'true');
      const res = await api<any[]>(`/tickets/analysis?${qs.toString()}`);
      // apply client-side safety-filtering so UI works even if backend doesn't support the query params yet
      let data = res || [];
      if (onlyAnalyzed) data = data.filter((t) => t.analysis && t.analysis.length);
      if (difficultyFilter) data = data.filter((t) => t.analysis && t.analysis.some((a: any) => a.difficulty === difficultyFilter));
      setItems(data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function openForTicket(id: string) {
    setModalTicketId(id);
    setModalDifficulty('');
    setModalNote('');
    setModalOpen(true);
  }

  async function submitAnalysis() {
    if (!modalTicketId) return;
    try {
      await api(`/tickets/${modalTicketId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: modalDifficulty || undefined, note: modalNote }),
      });
      setModalOpen(false);
      fetchData();
    } catch (e) {
      alert('Gönderilemedi');
    }
  }

  return (
    <>
      <Header />
      <div className="container">
        <h3 className="section-title">Analiz — Temsilci Hataları</h3>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div>
              <label className="inline-muted">Başlangıç</label>
              <div className="date-input">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 11H9V13H7V11ZM11 11H13V13H11V11ZM15 11H17V13H15V11ZM19 4H18V2H16V4H8V2H6V4H5C3.9 4 3 4.9 3 6V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20Z" fill="currentColor"/></svg>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="inline-muted">Bitiş</label>
              <div className="date-input">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 11H9V13H7V11ZM11 11H13V13H11V11ZM15 11H17V13H15V11ZM19 4H18V2H16V4H8V2H6V4H5C3.9 4 3 4.9 3 6V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20Z" fill="currentColor"/></svg>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="inline-muted">Agent</label>
              <select className="select" value={agent} onChange={(e) => setAgent(e.target.value)}>
                <option value="">Tümü</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className={`chip ${difficultyFilter === 'easy' ? 'active' : ''}`} onClick={() => setDifficultyFilter((d) => (d === 'easy' ? '' : 'easy'))}>Kolay</button>
              <button className={`chip ${difficultyFilter === 'medium' ? 'active' : ''}`} onClick={() => setDifficultyFilter((d) => (d === 'medium' ? '' : 'medium'))}>Orta</button>
              <button className={`chip ${difficultyFilter === 'hard' ? 'active' : ''}`} onClick={() => setDifficultyFilter((d) => (d === 'hard' ? '' : 'hard'))}>Zor</button>
            </div>

            <button className={`btn ${onlyAnalyzed ? 'primary' : ''}`} onClick={() => setOnlyAnalyzed((v) => !v)}>{onlyAnalyzed ? 'Sadece Analizliler (Açık)' : 'Sadece Analizliler'}</button>

            <button className="btn primary" onClick={fetchData}>Sorgula</button>
          </div>
        </div>

        {loading ? (
          <div className="card">Yükleniyor...</div>
        ) : (
          items.map((t) => (
            <div key={t.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontWeight: 800 }}>{t.assignedTo?.name || '—'}</div>
                    <div className="inline-muted">{new Date(t.createdAt).toLocaleString()}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div className="inline-muted">Durum: {t.status}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  {t.analysis && t.analysis.length ? (
                    t.analysis.map((a: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f0f0f0', fontWeight: 700, fontSize: 12 }}>
                          {a.difficulty === 'easy' ? 'Kolay' : a.difficulty === 'medium' ? 'Orta' : a.difficulty === 'hard' ? 'Zor' : a.difficulty}
                        </span>
                        <div style={{ flex: 1 }}>{a.note || '(not yok)'}</div>
                        <div className="inline-muted" style={{ minWidth: 160, textAlign: 'right' }}>{new Date(a.at).toLocaleString()}</div>
                      </div>
                    ))
                  ) : (
                    <div className="inline-muted">Analiz yok</div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700 }}>Orijinal Mesaj</div>
                <div className="msg" style={{ marginTop: 8 }}>{t.telegram?.text}</div>
                <div style={{ marginTop: 8 }}>
                  <button className="btn" onClick={() => openForTicket(t.id)}>Analiz Ekle</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h4>Analiz Ekle</h4>
            <div style={{ marginBottom: 8 }}>
              <label className="inline-muted">Zorluk</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button className={`chip ${modalDifficulty === 'easy' ? 'active' : ''}`} onClick={() => setModalDifficulty('easy')}>Kolay</button>
                <button className={`chip ${modalDifficulty === 'medium' ? 'active' : ''}`} onClick={() => setModalDifficulty('medium')}>Orta</button>
                <button className={`chip ${modalDifficulty === 'hard' ? 'active' : ''}`} onClick={() => setModalDifficulty('hard')}>Zor</button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="inline-muted">Not</label>
              <textarea value={modalNote} onChange={(e) => setModalNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn btn-success" onClick={submitAnalysis}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
