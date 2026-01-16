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

interface TicketLog {
  ticketId: string;
  shortId: string;
  ticketStatus: string;
  assignedToName: string;
  timestamp: string;
  action: string;
  note: string;
  byAgentId?: string;
  byAgentName?: string;
  senderName: string;
}

interface LogsResponse {
  items: BotLog[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface TicketLogsResponse {
  items: TicketLog[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function Logs() {
  const [viewMode, setViewMode] = useState<'bot' | 'ticket'>('ticket'); // Varsayılan ticket logları
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [ticketLogs, setTicketLogs] = useState<TicketLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>(''); // Ticket logları için
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (viewMode === 'bot') {
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
    } else {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page: String(page), limit: '50' });
        if (actionFilter) params.append('action', actionFilter);
        
        const res = await api.get<TicketLogsResponse>(`/logs/tickets?${params.toString()}`);
        setTicketLogs(res.items);
        setTotalPages(res.pages);
        setTotal(res.total);
      } catch (e) {
        setError('Ticket logları yüklenirken hata oluştu');
        console.error('Failed to fetch ticket logs:', e);
      } finally {
        setLoading(false);
      }
    }
  }, [page, levelFilter, eventFilter, actionFilter, viewMode]);

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
    }, 60000);
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
  
  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return '#10b981';
      case 'reassign': return '#f59e0b';
      case 'interested': return '#3b82f6';
      case 'resolved': return '#10b981';
      case 'unreachable': return '#ef4444';
      case 'reported': return '#8b5cf6';
      case 'waiting': return '#f97316';
      default: return '#6b7280';
    }
  };
  
  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Oluşturuldu';
      case 'reassign': return 'Yeniden Atama';
      case 'interested': return 'İlgileniyorum';
      case 'resolved': return 'Çözümlendi';
      case 'unreachable': return 'Ulaşılamadı';
      case 'reported': return 'Yazılıma İletildi';
      case 'waiting': return 'Üye Bekleniyor';
      default: return action;
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Açık';
      case 'resolved': return 'Çözümlendi';
      case 'unreachable': return 'Ulaşılamadı';
      case 'reported': return 'Yazılıma İletildi';
      case 'waiting': return 'Üye Bekleniyor';
      default: return status;
    }
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
          Loglar
        </h1>

        {/* Mod seçici */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #d1d5db' }}>
            <button
              onClick={() => { setViewMode('ticket'); setPage(1); }}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: viewMode === 'ticket' ? '#3b82f6' : 'white',
                color: viewMode === 'ticket' ? 'white' : '#374151',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem'
              }}
            >
              Ticket Logları (1 Aylık)
            </button>
            <button
              onClick={() => { setViewMode('bot'); setPage(1); }}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: viewMode === 'bot' ? '#3b82f6' : 'white',
                color: viewMode === 'bot' ? 'white' : '#374151',
                border: 'none',
                borderLeft: '1px solid #d1d5db',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem'
              }}
            >
              Bot Logları
            </button>
          </div>
        </div>

        {/* Filtreler */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {viewMode === 'bot' ? (
            <>
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
            </>
          ) : (
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: '500', marginRight: '0.5rem', color: '#374151' }}>
                Aksiyon:
              </label>
              <select 
                value={actionFilter} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setActionFilter(e.target.value); setPage(1); }}
                style={{
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              >
                <option value="">Tümü</option>
                <option value="created">Oluşturuldu</option>
                <option value="reassign">Yeniden Atama</option>
                <option value="interested">İlgileniyorum</option>
                <option value="resolved">Çözümlendi</option>
                <option value="unreachable">Ulaşılamadı</option>
                <option value="reported">Yazılıma İletildi</option>
                <option value="waiting">Üye Bekleniyor</option>
              </select>
            </div>
          )}

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
        {!loading && viewMode === 'bot' && logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Kayıt bulunamadı
          </div>
        )}
        
        {!loading && viewMode === 'ticket' && ticketLogs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Kayıt bulunamadı
          </div>
        )}

        {/* Ticket Logları */}
        {!loading && viewMode === 'ticket' && ticketLogs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {ticketLogs.map((log, idx) => (
              <div 
                key={`${log.ticketId}-${idx}`} 
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  backgroundColor: 'white',
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontFamily: 'monospace'
                  }}>
                    #{log.shortId}
                  </span>
                  
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backgroundColor: getActionColor(log.action),
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                  }}>
                    {getActionLabel(log.action)}
                  </span>
                  
                  <span style={{ fontSize: '0.875rem', color: '#374151', flex: 1 }}>
                    {log.note}
                  </span>
                  
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  <div>
                    <strong>Agent:</strong> {log.byAgentName || 'Sistem'}
                  </div>
                  <div>
                    <strong>Gönderen:</strong> {log.senderName}
                  </div>
                  <div>
                    <strong>Atanan:</strong> {log.assignedToName}
                  </div>
                  <div>
                    <strong>Durum:</strong> {getStatusLabel(log.ticketStatus)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bot Logları */}
        {!loading && viewMode === 'bot' && logs.length > 0 && (
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
