import { useState } from 'react';
import { api } from '../api';

export default function Login() {
  const [externalUserId, setExternalUserId] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | undefined>();
  const [registerMode, setRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Agent'|'Temsilci'>('Agent');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api<{ accessToken: string; agent: { id: string; name: string; role: 'agent' | 'supervisor' } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ externalUserId, password }) }
      );
      localStorage.setItem('token', res.accessToken);
      localStorage.setItem('me', JSON.stringify(res.agent));
      window.location.href = '/';
    } catch {
      setErr('Giriş başarısız');
    }
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api<{ accessToken: string; agent: { id: string; name: string; role: 'agent' | 'supervisor' } }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify({ name, externalUserId, password, role }) }
      );
      localStorage.setItem('token', res.accessToken);
      localStorage.setItem('me', JSON.stringify(res.agent));
      window.location.href = '/';
    } catch (er: any) {
      setErr(er?.message || 'Kayıt başarısız');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{registerMode ? 'Kayıt Ol' : 'Agent Giriş'}</h2>
        <button className="btn" onClick={() => setRegisterMode((s) => !s)}>{registerMode ? "Giriş'e Dön" : 'Kayıt Ol'}</button>
      </div>

      <form onSubmit={registerMode ? onRegister : onSubmit} style={{ display: 'grid', gap: 8 }}>
        {registerMode && (
          <>
            <input placeholder="İsim Soyisim" value={name} onChange={e => setName(e.target.value)} />
            <select value={role} onChange={e => setRole(e.target.value as any)} className="select">
              <option value="Agent">Agent</option>
              <option value="Temsilci">Temsilci</option>
            </select>
          </>
        )}

        <input placeholder="1009" value={externalUserId} onChange={e => setExternalUserId(e.target.value)} />
        <input placeholder="Şifre" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div style={{ color: 'red' }}>{err}</div>}
        <button>{registerMode ? 'Kayıt Ol' : 'Giriş yap'}</button>
      </form>
    </div>
  );
}
