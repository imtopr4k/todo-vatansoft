import { useState } from 'react';
import Header from '../Components/Header';
import { api } from '../api';

export default function AdminUsers() {
  const [name, setName] = useState('');
  const [externalUserId, setExternalUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Agent' | 'Temsilci'>('Agent');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const body = { name, externalUserId, password, role };
      const response = await api('/auth/register', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) 
      });
      setMsg('✅ Kullanıcı başarıyla oluşturuldu');
      setName(''); setExternalUserId(''); setPassword(''); setRole('Agent');
    } catch (err: any) {
      console.error('Register error:', err);
      const errorMsg = err?.message || err?.error || JSON.stringify(err) || 'Bilinmeyen hata';
      setMsg('❌ Hata: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <div className="container">
        <h3 className="section-title">Admin — Kullanıcı Ekle (Sadece Supervisor)</h3>
        <div className="card" style={{ maxWidth: 640 }}>
          <form onSubmit={onCreate} style={{ display: 'grid', gap: 8 }}>
            <label className="inline-muted">İsim</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />

            <label className="inline-muted">External User Id</label>
            <input value={externalUserId} onChange={(e) => setExternalUserId(e.target.value)} className="input" />

            <label className="inline-muted">Şifre</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />

            <label className="inline-muted">Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as any)} className="select">
              <option value="Agent">Agent</option>
              <option value="Temsilci">Temsilci</option>
            </select>

            {msg && <div className="inline-muted">{msg}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn primary" disabled={loading}>{loading ? 'Oluşturuluyor...' : 'Kullanıcı Ekle'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
