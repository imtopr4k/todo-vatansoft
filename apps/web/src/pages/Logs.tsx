import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { myExternalUserId } from '../auth';
import Header from '../Components/Header';

interface BotLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  event: string;
  data?: any;
  message?: string;
  chatId?: string;
  messageId?: number;
  fromId?: string;
  isBot?: boolean;
}

interface LogsResponse {
  items: BotLog[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function Logs() {
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (levelFilter) params.append('level', levelFilter);
      if (eventFilter) params.append('event', eventFilter);
      
      const res = await api.get<LogsResponse>(`/logs?${params.toString()}`);
      setLogs(res.items);
      setTotalPages(res.pages);
      setTotal(res.total);
    } catch (e) {
      setError('Log verisi yüklenirken hata oluştu');
      console.error('Failed to fetch logs:', e);
    } finally {
      setLoading(false);
    }
  }, [page, levelFilter, eventFilter]);

  useEffect(() => {
    // Sadece user 1009 erişebilir
    const ext = myExternalUserId();
    if (ext !== '1009') {
      setError('Bu sayfaya erişim yetkiniz yok');
      return;
    }
    fetchLogs();
  }, [fetchLogs]);

  // Otomatik yenileme (10 saniye)
  useEffect(() => {
    const interval = setInterval(() => {
      if (page === 1) {
        fetchLogs();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs, page]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#ef4444';
      case 'warn': return '#f59e0b';
      case 'info': return '#3b82f6';
      case 'debug': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'error': return '#fee';
      case 'warn': return '#fef3c7';
      case 'info': return '#dbeafe';
      case 'debug': return '#f3f4f6';
      default: return '#f9fafb';
    }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('tr-TR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedLog(expandedLog === id ? null : id);
  };

  if (myExternalUserId() !== '1009') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Erişim Engellendi</h2>
        <p>Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '1.5rem', color: '#111827' }}>
          Bot Logları
        </h1>

        {/* Filtreler */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: '500', marginRight: '0.5rem', color: '#374151' }}>
              Seviye:
            </label>
            <select 
              value={levelFilter} 
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setLevelFilter(e.target.value); setPage(1); }}
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            >
              <option value="">Tümü</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: '500', marginRight: '0.5rem', color: '#374151' }}>
              Event:
            </label>
            <input 
              type="text" 
              value={eventFilter} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setEventFilter(e.target.value); setPage(1); }}
              placeholder="Ara..."
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                outline: 'none',
                width: '200px'
              }}
            />
          </div>

          <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280' }}>
            Toplam: <strong>{total}</strong> kayıt
          </div>
        </div>

        {/* Hata mesajı */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            color: '#991b1b'
          }}>
            {error}
          </div>
        )}

        {/* Yükleniyor */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Yükleniyor...
          </div>
        )}

        {/* Loglar */}
        {!loading && logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Kayıt bulunamadı
          </div>
        )}

        {!loading && logs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {logs.map(log => (
              <div 
                key={log.id} 
                style={{
                  border: `1px solid ${getLevelColor(log.level)}`,
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  backgroundColor: getLevelBg(log.level),
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                }}
                onClick={() => toggleExpand(log.id)}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* Başlık satırı */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    color: getLevelColor(log.level),
                    backgroundColor: '#fff',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    minWidth: '60px',
                    textAlign: 'center'
                  }}>
                    {log.level}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827', flex: 1 }}>
                    {log.event}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>

                {/* Mesaj */}
                {log.message && (
                  <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>
                    {log.message}
                  </div>
                )}

                {/* Meta bilgiler */}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#6b7280', flexWrap: 'wrap' }}>
                  {log.chatId && <span>Chat: {log.chatId}</span>}
                  {log.messageId && <span>Msg: {log.messageId}</span>}
                  {log.fromId && <span>From: {log.fromId}</span>}
                  {log.isBot !== undefined && <span>Bot: {log.isBot ? 'Evet' : 'Hayır'}</span>}
                </div>

                {/* Genişletilmiş detay */}
                {expandedLog === log.id && log.data && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#fff',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    border: '1px solid #d1d5db'
                  }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '0.5rem', 
            marginTop: '2rem',
            alignItems: 'center'
          }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                backgroundColor: page === 1 ? '#f3f4f6' : '#fff',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Önceki
            </button>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Sayfa {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                backgroundColor: page === totalPages ? '#f3f4f6' : '#fff',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Sonraki
            </button>
          </div>
        )}
      </div>
    </>
  );
}
