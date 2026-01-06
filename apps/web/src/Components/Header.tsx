import { me, logout } from '../auth';
import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { Link, useLocation } from 'react-router-dom';
// const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
const BOT_USERNAME = 'VatansoftTeknikBot';

export default function Header() {
  const user = me();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
  const [allAgents, setAllAgents] = useState<Array<{ id: string; name: string; externalUserId?: string; isActive: boolean }>>([]);
  const [showSpecialView, setShowSpecialView] = useState(false);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const list = await api<any[]>('/agents');
        const meAgent = list.find((a) => String(a.id) === String(user?.id));
        if (mounted) setIsActive(!!meAgent?.isActive);
        
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
        const canSee = ['1009'].includes(myExt);
        if (mounted) setShowSpecialView(canSee);
        
        // Online kullanıcıları sadece externalUserId 1009 görebilir
        const canSeeOnlineUsers = myExt === '1009';
        if (mounted) setShowOnlineUsers(canSeeOnlineUsers);
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

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get current page name
  const getPageName = () => {
    if (location.pathname === '/tickets') return 'Görevler';
    if (location.pathname === '/chat') return 'Sohbet';
    if (location.pathname === '/stats') return 'İstatistik';
    if (location.pathname === '/analysis') return 'Analiz';
    if (location.pathname === '/business-setup') return 'Business Kurulum';
    if (location.pathname === '/logs') return 'Loglar';
    return 'Ana Sayfa';
  };

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
      {/* Sol taraf - Logo ve Menü Dropdown */}
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="brand">TELEGRAMTODO</div>
        
        {/* Modern Dropdown Menu */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              backgroundColor: 'var(--surface, rgba(255,255,255,0.05))',
              border: '1px solid var(--border, rgba(255,255,255,0.1))',
              borderRadius: '8px',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.1))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface, rgba(255,255,255,0.05))';
            }}
          >
            <span>📋</span>
            <span>{getPageName()}</span>
            <span style={{ 
              fontSize: 10, 
              transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}>▼</span>
          </button>

          {/* Dropdown Content */}
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                minWidth: 200,
                backgroundColor: 'var(--surface, #1e293b)',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              <Link 
                to="/tickets" 
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  color: location.pathname === '/tickets' ? 'var(--primary, #3b82f6)' : 'var(--text)',
                  textDecoration: 'none',
                  fontWeight: location.pathname === '/tickets' ? 600 : 500,
                  fontSize: '14px',
                  backgroundColor: location.pathname === '/tickets' ? 'var(--hover-bg, rgba(59,130,246,0.1))' : 'transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== '/tickets') {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.05))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== '/tickets') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>📝</span>
                <span>Görevler</span>
              </Link>

              <Link 
                to="/chat" 
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  color: location.pathname === '/chat' ? 'var(--primary, #3b82f6)' : 'var(--text)',
                  textDecoration: 'none',
                  fontWeight: location.pathname === '/chat' ? 600 : 500,
                  fontSize: '14px',
                  backgroundColor: location.pathname === '/chat' ? 'var(--hover-bg, rgba(59,130,246,0.1))' : 'transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== '/chat') {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.05))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== '/chat') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>💬</span>
                <span>Sohbet</span>
              </Link>

              <Link 
                to="/stats" 
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  color: location.pathname === '/stats' ? 'var(--primary, #3b82f6)' : 'var(--text)',
                  textDecoration: 'none',
                  fontWeight: location.pathname === '/stats' ? 600 : 500,
                  fontSize: '14px',
                  backgroundColor: location.pathname === '/stats' ? 'var(--hover-bg, rgba(59,130,246,0.1))' : 'transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== '/stats') {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.05))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== '/stats') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>📊</span>
                <span>İstatistik</span>
              </Link>

              <Link 
                to="/analysis" 
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  color: location.pathname === '/analysis' ? 'var(--primary, #3b82f6)' : 'var(--text)',
                  textDecoration: 'none',
                  fontWeight: location.pathname === '/analysis' ? 600 : 500,
                  fontSize: '14px',
                  backgroundColor: location.pathname === '/analysis' ? 'var(--hover-bg, rgba(59,130,246,0.1))' : 'transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== '/analysis') {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.05))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== '/analysis') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>📈</span>
                <span>Analiz</span>
              </Link>

              <Link 
                to="/business-setup" 
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  color: location.pathname === '/business-setup' ? 'var(--primary, #3b82f6)' : 'var(--text)',
                  textDecoration: 'none',
                  fontWeight: location.pathname === '/business-setup' ? 600 : 500,
                  fontSize: '14px',
                  backgroundColor: location.pathname === '/business-setup' ? 'var(--hover-bg, rgba(59,130,246,0.1))' : 'transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== '/business-setup') {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.05))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== '/business-setup') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>💼</span>
                <span>Business Kurulum</span>
              </Link>

              {showSpecialView && (
                <Link 
                  to="/logs" 
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    color: location.pathname === '/logs' ? 'var(--primary, #3b82f6)' : 'var(--text)',
                    textDecoration: 'none',
                    fontWeight: location.pathname === '/logs' ? 600 : 500,
                    fontSize: '14px',
                    backgroundColor: location.pathname === '/logs' ? 'var(--hover-bg, rgba(59,130,246,0.1))' : 'transparent',
                    transition: 'all 0.15s',
                    borderTop: '1px solid var(--border, rgba(255,255,255,0.1))',
                  }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== '/logs') {
                      e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.05))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== '/logs') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>📄</span>
                  <span>Loglar</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Online Users - Ortada */}
      {showOnlineUsers && allAgents && allAgents.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: 6, 
          alignItems: 'center',
          transform: 'translateX(-45%)',
        }}>
          {allAgents.map(a => (
            <div 
              key={a.id} 
              className="assigned-pill" 
              title={`${a.name} (#${a.externalUserId}) - ${a.isActive ? 'Aktif' : 'Pasif'}`} 
              style={{ 
                padding: '6px 12px',
                fontSize: '13px',
              }}
            >
              <span 
                className="pill-dot" 
                aria-hidden 
                style={{ 
                  marginLeft: -4, 
                  backgroundColor: a.isActive ? '#10b981' : '#6b7280'
                }} 
              />
              <span style={{ fontWeight: 600 }}>{a.name || a.externalUserId}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sağ taraf - Actions */}
      <div className="header-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Karanlık modu kapat' : 'Karanlık modu aç'}
            className="btn ghost"
            aria-label="Tema değiştir"
            style={{ padding: '8px 12px' }}
          >
            <span style={{ fontSize: 18 }}>{theme === 'dark' ? '🌙' : '☀️'}</span>
          </button>

          <button 
            className="btn" 
            onClick={openTelegramLink} 
            title="Telegram eşleştir"
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            Telegram
          </button>

          <button
            className={`chip ${isActive ? 'active' : ''}`}
            onClick={async () => {
              if (!user?.id) return;
              const next = !isActive;
              setIsActive(next as boolean);
              try {
                await api('/auth/set-active', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isActive: next }),
                });
              } catch (e) {
                setIsActive((s) => !!s);
                alert('Durum güncellenemedi');
              }
            }}
            title={isActive ? 'Aktif — tıklayarak pasif yap' : 'Pasif — tıklayarak aktif yap'}
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            {isActive ? 'Aktif' : 'Pasif'}
          </button>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10,
            paddingLeft: 12,
            borderLeft: '1px solid var(--border, rgba(255,255,255,0.1))'
          }}>
            <div className="avatar" style={{ width: 36, height: 36 }}>
              {(user?.name?.[0] || 'U').toUpperCase()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{user?.name || 'Kullanıcı'}</span>
              <small style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {user?.role === 'supervisor' ? 'Supervisor' : 'Agent'}
              </small>
            </div>

            <button 
              onClick={logout} 
              className="btn danger" 
              title="Oturumu kapat"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Çıkış
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
