import { useState } from 'react';
import { api } from '../api';

export default function Login() {
  const [externalUserId, setExternalUserId] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | undefined>();

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

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 360, margin: '80px auto', display: 'grid', gap: 8 }}>
      <h2>Agent Giriş</h2>
      <input
        placeholder="1009"
        value={externalUserId}
        onChange={e => setExternalUserId(e.target.value)}
      />
      <input
        placeholder="Şifre"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {err && <div style={{ color: 'red' }}>{err}</div>}
      <button>Giriş yap</button>
    </form>
  );
}
