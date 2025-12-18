import { useState } from 'react';
import { api } from '../api';

export default function Login() {
  const [externalUserId, setExternalUserId] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | undefined>();
  const [name, setName] = useState('');

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

  // registration is disabled in UI; user creation is limited to admins via API

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Agent Giriş</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <input placeholder="1009" value={externalUserId} onChange={e => setExternalUserId(e.target.value)} />
        <input placeholder="Şifre" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div style={{ color: 'red' }}>{err}</div>}
        <button>Giriş yap</button>
      </form>
    </div>
  );
}
