import { useEffect, useState } from 'react';

interface SystemHealth {
  api: {
    status: 'up' | 'down';
    uptime: number;
    lastCheck: Date;
  };
  bot: {
    status: 'up' | 'down';
    lastPing: Date | null;
  };
  database: {
    status: 'up' | 'down';
    lastCheck: Date;
  };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export function SystemStatus() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        setHealth(data);
        setLastUpdate(new Date());
      } catch (e) {
        console.error('Health check failed:', e);
        setHealth(null);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Her 10 saniyede bir kontrol

    return () => clearInterval(interval);
  }, []);

  if (!health) {
    return (
    //   <div style={{
    //     position: 'fixed',
    //     top: 16,
    //     right: 16,
    //     background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    //     color: 'white',
    //     padding: '12px 20px',
    //     borderRadius: 12,
    //     boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
    //     zIndex: 9999,
    //     fontSize: 14,
    //     fontWeight: 600,
    //     display: 'flex',
    //     alignItems: 'center',
    //     gap: 10,
    //     backdropFilter: 'blur(10px)',
    //     border: '1px solid rgba(255, 255, 255, 0.1)'
    //   }}>
    //     { <span style={{ fontSize: 18 }}>⚠️</span>
    //     <span>Sistem Bağlantısı Yok</span> }
    //   </div>
    null
    );
  }

  const hasIssue = health.api.status === 'down' || 
                   health.bot.status === 'down' || 
                   health.database.status === 'down';

  if (!hasIssue) return null; // Her şey normal, gösterme

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: 'white',
      padding: '16px 24px',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
      zIndex: 9999,
      fontSize: 14,
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      minWidth: 280
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 10,
        marginBottom: 12,
        fontSize: 16,
        fontWeight: 700
      }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <span>Sistem Uyarısı</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
        <StatusRow 
          label="API" 
          status={health.api.status} 
          detail={`Uptime: ${Math.floor(health.api.uptime / 60)}dk`}
        />
        <StatusRow 
          label="Bot" 
          status={health.bot.status}
          detail={health.bot.lastPing ? `Son ping: ${getTimeAgo(new Date(health.bot.lastPing))}` : 'Hiç ping yok'}
        />
        <StatusRow 
          label="Database" 
          status={health.database.status}
        />
      </div>

      <div style={{ 
        marginTop: 12, 
        paddingTop: 12, 
        borderTop: '1px solid rgba(255,255,255,0.2)',
        fontSize: 11,
        opacity: 0.8
      }}>
        Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
      </div>

      {(health.bot.status === 'down' || health.api.status === 'down') && (
        <div style={{
          marginTop: 12,
          padding: 10,
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 8,
          fontSize: 12
        }}>
          🔄 Sistem otomatik olarak yeniden başlatılacak...
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, status, detail }: { label: string; status: 'up' | 'down'; detail?: string }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '6px 10px',
      background: 'rgba(0,0,0,0.1)',
      borderRadius: 6
    }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {detail && <span style={{ opacity: 0.8, fontSize: 11 }}>{detail}</span>}
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: status === 'up' ? '#10b981' : '#ef4444',
          boxShadow: status === 'up' 
            ? '0 0 8px #10b981' 
            : '0 0 8px #ef4444'
        }} />
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}sn önce`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}dk önce`;
  const hours = Math.floor(minutes / 60);
  return `${hours}sa önce`;
}
