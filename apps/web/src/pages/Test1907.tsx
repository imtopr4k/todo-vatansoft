import { useEffect, useState } from 'react';
import Header from '../Components/Header';
import { api } from '../api';

export default function Test1907() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await api<any[]>('/agents');
        const a = list.find(x => String(x.externalUserId) === '1907');
        if (mounted && a) setAgentName(a.name || String(a.externalUserId));
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function onSend(e?: React.FormEvent) {
    e?.preventDefault();
    setResult(null);
    setSending(true);
    try {
      let payloadText = text || '(test)';
      if (agentName) payloadText = payloadText + '\n\nEkstra: ' + agentName;

      const res = await api<{ ticketId?: string; pending?: boolean }>('/bot/intake', {
        method: 'POST', body: JSON.stringify({ chatId: 0, messageId: 0, text: payloadText, from: { id: 0, username: 'test' } })
      });

      setResult('Gönderildi. TicketId: ' + (res.ticketId || '—') + (res.pending ? ' (pending)' : ''));
      setText('');
    } catch (err: any) {
      setResult('Hata: ' + String(err?.message || err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Header />
      <div className="container">
        <h3>1907 Test Gönderimi</h3>
        <div className="card" style={{ maxWidth: 800 }}>
          <form onSubmit={onSend} style={{ display: 'grid', gap: 12 }}>
            <label className="inline-muted">Mesaj (gruptaki şablon formatında)</label>
            <textarea value={text} onChange={e => setText(e.target.value)} className="msg" />

            <div className="inline-muted">Bu test mesajı otomatik olarak 1907'ye atanmak üzere gönderilecektir (Ekstra: agent adı eklenecek).</div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" disabled={sending}>{sending ? 'Gönderiliyor...' : 'Gönder (1907)'}</button>
              <button type="button" className="btn" onClick={() => setText('')}>Temizle</button>
            </div>
            {result && <div className="inline-muted">{result}</div>}
          </form>
        </div>
      </div>
    </>
  );
}
