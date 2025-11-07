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
      const res = await api<any[]>(`/tickets/analysis?${qs.toString()}`);
      setItems(res);
    } catch (e) {
      console.error('analysis fetch failed', e);
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
      console.error('submit analysis failed', e);
      alert('Gönderilemedi');
    }
  }

  return (
    <>
      <Header />
      <div className="container">
        <h3 className="section-title">Analiz — Temsilci Hataları</h3>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div>
            <label className="inline-muted">Başlangıç</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="inline-muted">Bitiş</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
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

          <div style={{ marginLeft: 'auto' }}>
            <button className="btn primary" onClick={fetchData}>Sorgula</button>
          </div>
        </div>

        {loading ? (
          <div className="card">Yükleniyor...</div>
        ) : (
          items.map((t) => (
            <div key={t.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{t.assignedTo?.name || '—'}</div>
                  <div className="inline-muted">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="inline-muted">Durum: {t.status}</div>
                  <div style={{ marginTop: 6 }}>
                    {t.analysis && t.analysis.length ? (
                      t.analysis.map((a: any, idx: number) => (
                        <div key={idx} style={{ fontSize: 13, marginBottom: 6 }}>
                          <strong>{a.difficulty || '—'}</strong> — {a.note || '(not yok)'} <span className="inline-muted">{new Date(a.at).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="inline-muted">Analiz yok</div>
                    )}
                  </div>
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
