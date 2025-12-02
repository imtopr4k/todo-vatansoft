import { me, logout } from '../auth';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';
// const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
const BOT_USERNAME = 'VatansoftTeknikBot';

export default function Header() {
  const user = me();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const s = localStorage.getItem('theme');
      if (s === 'dark' || s === 'light') return s;
    } catch (e) {}
    return 'dark';
  });

  useEffect(() => {
    try {
      const el = document.documentElement;
      if (theme === 'dark') el.classList.add('dark');
      else el.classList.remove('dark');
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }, [theme]);

  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [allAgents, setAllAgents] = useState<Array<{ id: string; name: string; externalUserId?: string; isActive: boolean }>>([]);
  const [showSpecialView, setShowSpecialView] = useState(false);
  const [adminView, setAdminView] = useState<'agent' | 'temsilci'>(() => (localStorage.getItem('adminViewMode') === 'agents' ? 'agent' : 'temsilci'));

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const list = await api<any[]>('/agents');
        const meAgent = list.find((a) => String(a.id) === String(user?.id));
        if (mounted) setIsActive(!!meAgent?.isActive);
        if (meAgent && String(meAgent.externalUserId) === '1') {
          setIsSuperUser(true);
        }
        
        // Tüm ajanları kaydet (externalUserId 1 hariç)
        const filteredAgents = list
          .filter(a => String(a.externalUserId) !== '1')
          .map(a => ({ 
            id: String(a.id), 
            name: a.name, 
            externalUserId: String(a.externalUserId),
            isActive: !!a.isActive
          }))
          .sort((a, b) => {
            // Önce aktif olanlar, sonra pasifler
            if (a.isActive === b.isActive) {
              return Number(a.externalUserId) - Number(b.externalUserId);
            }
            return a.isActive ? -1 : 1;
          });
        
        if (mounted) setAllAgents(filteredAgents);
        
        // Only show this special view to users with externalUserId 1 or 1907
        const myExt = meAgent ? String(meAgent.externalUserId) : '';
        const canSee = ['1', '1907'].includes(myExt);
        if (mounted) setShowSpecialView(canSee);
      } catch (e) {
        console.error('Failed to load agents:', e);
      }
    }
    load();
    
    // Her 10 saniyede bir güncelle
    const interval = setInterval(load, 10000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  function openTelegramLink() {
    if (!user?.id || !BOT_USERNAME) {
      alert('id veya BOT_USERNAME eksik.');
      return;
    }
    const link = `https://t.me/${BOT_USERNAME}?start=aid-${user?.id}`;
    window.open(link, '_blank');
  }

  return (
    <header className="header">
      <div className="header-left">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="brand">TELEGRAMTODO</div>
          <nav style={{ display: 'flex', gap: 8 }}>
            <Link to="/tickets" style={{ color: 'var(--muted)', fontWeight: 700, textDecoration: 'none' }}>Görevler</Link>
            <Link to="/stats" style={{ color: 'var(--muted)', fontWeight: 700, textDecoration: 'none' }}>İstatistik</Link>
            <Link to="/analysis" style={{ color: 'var(--muted)', fontWeight: 700, textDecoration: 'none' }}>Analiz</Link>
            {user?.role === 'supervisor' && (
              <Link to="/admin" style={{ color: 'var(--muted)', fontWeight: 700, textDecoration: 'none' }}>Admin</Link>
            )}
          </nav>
          {allAgents && allAgents.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginLeft: 8, alignItems: 'center' }}>
              {allAgents.map(a => (
                <div key={a.id} className="assigned-pill" title={`${a.name} (#${a.externalUserId}) - ${a.isActive ? 'Aktif' : 'Pasif'}`} style={{ padding: '6px 10px' }}>
                  <span 
                    className="pill-dot" 
                    aria-hidden 
                    style={{ 
                      marginLeft: -4, 
                      backgroundColor: a.isActive ? '#10b981' : '#6b7280'
                    }} 
                  />
                  <span style={{ fontWeight: 700 }}>{a.name || a.externalUserId}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* center admin toggle for externalUserId=1 */}
      {isSuperUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--muted)', marginRight: 8 }}>Mode</div>
          <button className={`chip ${adminView === 'agent' ? 'active' : ''}`} onClick={() => { localStorage.setItem('adminViewMode', 'agents'); setAdminView('agent'); window.dispatchEvent(new CustomEvent('adminViewChange', { detail: 'agents' })); }}>Agent</button>
          <button className={`chip ${adminView === 'temsilci' ? 'active' : ''}`} onClick={() => { localStorage.setItem('adminViewMode', 'temsilci'); setAdminView('temsilci'); window.dispatchEvent(new CustomEvent('adminViewChange', { detail: 'temsilci' })); }}>Temsilci</button>
        </div>
      )}

      <div className="header-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Karanlık modu kapat' : 'Karanlık modu aç'}
            className="btn ghost"
            aria-label="Tema değiştir"
          >
            <span style={{ fontSize: 16 }}>{theme === 'dark' ? '🌙' : '☀️'}</span>
          </button>

          <button className="btn" onClick={openTelegramLink} title="Telegram eşleştir">
            Telegram
          </button>

          {/* active toggle */}
          <button
            className={`chip ${isActive ? 'active' : ''}`}
            onClick={async () => {
              if (!user?.id) return;
              const next = !isActive;
              // optimistic
              setIsActive(next as boolean);
              try {
                await api('/auth/set-active', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isActive: next }),
                });
              } catch (e) {
                // revert on error
                setIsActive((s) => !!s);
                alert('Durum güncellenemedi');
              }
            }}
            title={isActive ? 'Aktif — tıklayarak pasif yap' : 'Pasif — tıklayarak aktif yap'}
          >
            {isActive ? 'Aktif' : 'Pasif'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="avatar">{(user?.name?.[0] || 'U').toUpperCase()}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.0 }}>
            <span style={{ fontWeight: 700 }}>{user?.name || 'Kullanıcı'}</span>
            <small style={{ color: 'var(--muted)' }}>{user?.role === 'supervisor' ? 'Supervisor' : 'Agent'}</small>
          </div>

          <button onClick={logout} className="btn danger" style={{ marginLeft: 8 }} title="Oturumu kapat">
            Çıkış
          </button>
        </div>
      </div>
    </header>
  );
}
