import { useState } from 'react';
import { api } from '../api';

export default function Login() {
  const [externalUserId, setExternalUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ accessToken: string; agent: { id: string; name: string; role: 'agent' | 'supervisor' } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ externalUserId, password }) }
      );
      localStorage.setItem('token', res.accessToken);
      localStorage.setItem('me', JSON.stringify(res.agent));
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '-50%', right: '-20%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        borderRadius: '50%', animation: 'float 20s ease-in-out infinite'
      }}></div>
      <div style={{
        position: 'absolute', bottom: '-30%', left: '-15%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
        borderRadius: '50%', animation: 'float 15s ease-in-out infinite reverse'
      }}></div>
      <style>{`
        @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -30px); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{
        width: '100%', maxWidth: '420px', background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)', borderRadius: '24px', padding: '48px 40px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.3)',
        animation: 'fadeIn 0.6s ease-out', position: 'relative', zIndex: 1
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '80px', height: '80px', margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '36px', fontWeight: '800', color: '#fff', boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)'
          }}>📋</div>
          <h1 style={{
            margin: '0 0 8px', fontSize: '28px', fontWeight: '800',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>Hoş Geldiniz</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '15px', fontWeight: '500' }}>Hesabınıza giriş yapın</p>
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && <div style={{
            padding: '16px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px',
            color: '#ef4444', fontSize: '14px', fontWeight: '600'
          }}>{error}</div>}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '700', color: '#374151' }}>Kullanıcı ID</label>
            <input type="text" value={externalUserId} onChange={e => setExternalUserId(e.target.value)}
              placeholder="ID numaranızı girin" required style={{
                width: '100%', padding: '14px 16px', fontSize: '15px', border: '2px solid #e5e7eb',
                borderRadius: '12px', outline: 'none', fontWeight: '600', color: '#111827'
              }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '700', color: '#374151' }}>Şifre</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Şifrenizi girin" required style={{
                width: '100%', padding: '14px 16px', fontSize: '15px', border: '2px solid #e5e7eb',
                borderRadius: '12px', outline: 'none', fontWeight: '600', color: '#111827'
              }} />
          </div>
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '16px', fontSize: '16px', fontWeight: '700', color: '#fff',
            background: loading ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 10px 30px rgba(102, 126, 234, 0.3)', marginTop: '8px'
          }}>{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
        </form>
        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af', fontWeight: '500' }}>© 2025 TelegramTodo</p>
        </div>
      </div>
    </div>
  );
}
