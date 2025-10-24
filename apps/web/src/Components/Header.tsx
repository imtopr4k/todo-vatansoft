import { me, logout } from '../auth';
// const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
const BOT_USERNAME = 'VatansoftTeknikBot';
export default function Header() {
  const user = me();
  function openTelegramLink() {
    if (!user?.id || !BOT_USERNAME) {
      alert('id veya BOT_USERNAME eksik.');
      return;
    }
    const link = `https://t.me/${BOT_USERNAME}?start=aid-${user?.id}`;
    window.open(link, '_blank');
  }
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff',
      position: 'sticky', top: 0, zIndex: 10
    }}>
      <div style={{ fontWeight: 700 }}>
        TELEGRAMTODO
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* User icon */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#eef2ff', color: '#3730a3',
          display: 'grid', placeItems: 'center', fontWeight: 700
        }}>
          {/* İsim baş harfi */}
          {(user?.name?.[0] || 'U').toUpperCase()}
        </div>
        <button className="chip" onClick={openTelegramLink}>Telegram eşleştir</button>
        {/* İsim + rol */}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontWeight: 600 }}>{user?.name || 'Kullanıcı'}</span>
          <small style={{ color: '#6b7280' }}>{user?.role === 'supervisor' ? 'Supervisor' : 'Agent'}</small>
        </div>

        {/* Çıkış butonu */}
        <button
          onClick={logout}
          style={{
            marginLeft: 8, padding: '6px 10px', borderRadius: 8,
            border: '1px solid #ef4444', background: '#ef4444', color: '#fff',
            fontWeight: 600, cursor: 'pointer'
          }}
          title="Oturumu kapat"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}
