import { useState, useEffect } from 'react';
import { me } from '../auth';
import { api } from '../api';
import Header from '../Components/Header';
import { useNavigate } from 'react-router-dom';

interface Stats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  unreachableTickets: number;
  reportedTickets: number;
  waitingTickets: number;
  myTickets: number;
  activeAgents: number;
}

interface RecentTicket {
  id: string;
  status: string;
  telegram: {
    from: { displayName?: string; username?: string };
    text?: string;
  };
  assignedTo: any;
  createdAt: string;
  shortId?: string;
}

interface AgentStats {
  id: string;
  name: string;
  externalUserId?: string;
  total: number;
  open: number;
  resolved: number;
  unreachable: number;
  reported: number;
}

export default function Dashboard() {
  const user = me();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0,
    unreachableTickets: 0,
    reportedTickets: 0,
    waitingTickets: 0,
    myTickets: 0,
    activeAgents: 0,
  });
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Paralel olarak tüm verileri çek
      const [
        totalRes,
        openRes,
        resolvedRes,
        unreachableRes,
        reportedRes,
        waitingRes,
        myRes,
        agentsRes,
        recentRes,
        agentStatsRes
      ] = await Promise.all([
        api<{ total: number }>('/tickets?limit=1'),
        api<{ total: number }>('/tickets?status=open&limit=1'),
        api<{ total: number }>('/tickets?status=resolved&limit=1'),
        api<{ total: number }>('/tickets?status=unreachable&limit=1'),
        api<{ total: number }>('/tickets?status=reported&limit=1'),
        api<{ total: number }>('/tickets?status=waiting&limit=1'),
        api<{ total: number }>('/tickets?assignedTo=me&status=open&limit=1'),
        api<any[]>('/agents'),
        api<{ tickets: RecentTicket[] }>('/tickets?limit=5&assignedTo=all'),
        api<AgentStats[]>('/tickets/stats/agents')
      ]);

      setStats({
        totalTickets: totalRes.total || 0,
        openTickets: openRes.total || 0,
        resolvedTickets: resolvedRes.total || 0,
        unreachableTickets: unreachableRes.total || 0,
        reportedTickets: reportedRes.total || 0,
        waitingTickets: waitingRes.total || 0,
        myTickets: myRes.total || 0,
        activeAgents: agentsRes.filter((a: any) => a.isActive).length || 0,
      });

      setRecentTickets(recentRes.tickets || []);
      setAgentStats(agentStatsRes.slice(0, 10) || []); // İlk 10 agent
    } catch (error) {
      console.error('Dashboard data yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'badge open';
      case 'resolved': return 'badge resolved';
      case 'unreachable': return 'badge unreachable';
      case 'reported': return 'badge reported';
      case 'waiting': return 'badge';
      default: return 'badge';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Açık';
      case 'resolved': return 'Çözüldü';
      case 'unreachable': return 'Ulaşılamadı';
      case 'reported': return 'Raporlandı';
      case 'waiting': return 'Bekliyor';
      default: return status;
    }
  };

  return (
    <>
      <Header />
      <div className="dashboard-container">
        <div className="container">
          {/* Başlık */}
          <div className="dashboard-header">
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">Hoş geldiniz, {user?.name || 'Agent'}</p>
          </div>

          {loading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              {/* İstatistik Kartları */}
              <div className="stats-grid">
                {/* Toplam Talepler */}
                <div className="stat-card stat-card-blue" onClick={() => navigate('/tickets')}>
                  <div className="stat-content">
                    <div className="stat-info">
                      <p className="stat-label">Toplam Talep</p>
                      <p className="stat-value">{stats.totalTickets}</p>
                    </div>
                    <div className="stat-icon stat-icon-blue">
                      <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Açık Talepler */}
                <div className="stat-card stat-card-green" onClick={() => navigate('/tickets?status=open')}>
                  <div className="stat-content">
                    <div className="stat-info">
                      <p className="stat-label">Açık Talepler</p>
                      <p className="stat-value">{stats.openTickets}</p>
                    </div>
                    <div className="stat-icon stat-icon-green">
                      <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Benim Taleplerim */}
                <div className="stat-card stat-card-purple" onClick={() => navigate('/tickets?assignedTo=me&status=open')}>
                  <div className="stat-content">
                    <div className="stat-info">
                      <p className="stat-label">Benim Taleplerim</p>
                      <p className="stat-value">{stats.myTickets}</p>
                    </div>
                    <div className="stat-icon stat-icon-purple">
                      <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Aktif Agentlar */}
                <div className="stat-card stat-card-orange" onClick={() => navigate('/stats')}>
                  <div className="stat-content">
                    <div className="stat-info">
                      <p className="stat-label">Aktif Agent</p>
                      <p className="stat-value">{stats.activeAgents}</p>
                    </div>
                    <div className="stat-icon stat-icon-orange">
                      <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* İkinci Sıra Kartlar */}
              <div className="stats-grid-mini">
                {/* Çözülen Talepler */}
                <div className="stat-mini-card" onClick={() => navigate('/tickets?status=resolved')}>
                  <div className="stat-mini-content">
                    <div className="stat-mini-info">
                      <p className="stat-mini-label">Çözüldü</p>
                      <p className="stat-mini-value stat-mini-success">{stats.resolvedTickets}</p>
                    </div>
                    <div className="stat-mini-icon stat-mini-success">
                      <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Ulaşılamayan */}
                <div className="stat-mini-card" onClick={() => navigate('/tickets?status=unreachable')}>
                  <div className="stat-mini-content">
                    <div className="stat-mini-info">
                      <p className="stat-mini-label">Ulaşılamadı</p>
                      <p className="stat-mini-value stat-mini-danger">{stats.unreachableTickets}</p>
                    </div>
                    <div className="stat-mini-icon stat-mini-danger">
                      <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Raporlanan */}
                <div className="stat-mini-card" onClick={() => navigate('/tickets?status=reported')}>
                  <div className="stat-mini-content">
                    <div className="stat-mini-info">
                      <p className="stat-mini-label">Raporlandı</p>
                      <p className="stat-mini-value stat-mini-warning">{stats.reportedTickets}</p>
                    </div>
                    <div className="stat-mini-icon stat-mini-warning">
                      <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Bekleyen */}
                <div className="stat-mini-card" onClick={() => navigate('/tickets?status=waiting')}>
                  <div className="stat-mini-content">
                    <div className="stat-mini-info">
                      <p className="stat-mini-label">Bekliyor</p>
                      <p className="stat-mini-value stat-mini-muted">{stats.waitingTickets}</p>
                    </div>
                    <div className="stat-mini-icon stat-mini-muted">
                      <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alt Bölümler - 2 kolon */}
              <div className="dashboard-panels">
                {/* Agent Sıralaması */}
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">Agent Sıralaması</h2>
                    <button onClick={() => navigate('/stats')} className="panel-link">
                      Detaylar →
                    </button>
                  </div>
                  <div className="agent-list">
                    {agentStats.length === 0 ? (
                      <p className="no-data">Veri yok</p>
                    ) : (
                      agentStats.map((agent, index) => (
                        <div key={agent.id} className="agent-item">
                          <div className="agent-rank-info">
                            <div className="agent-rank">
                              <span className={`rank-badge ${
                                index === 0 ? 'rank-gold' : 
                                index === 1 ? 'rank-silver' : 
                                index === 2 ? 'rank-bronze' : 
                                'rank-normal'
                              }`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                              </span>
                              <div className="agent-info">
                                <p className="agent-name">{agent.name}</p>
                                <p className="agent-total">Toplam: {agent.total}</p>
                              </div>
                            </div>
                            <div className="agent-resolved">
                              <p className="resolved-count">{agent.resolved}</p>
                              <p className="resolved-label">Çözülen</p>
                            </div>
                          </div>
                          <div className="agent-badges">
                            <span className="badge open">Açık: {agent.open}</span>
                            <span className="badge unreachable">Ulaşılamayan: {agent.unreachable}</span>
                            <span className="badge reported">Raporlanan: {agent.reported}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Hızlı Eylemler */}
                <div className="panel">
                  <h2 className="panel-title">Hızlı Eylemler</h2>
                  <div className="action-buttons">
                    <button
                      onClick={() => navigate('/tickets?assignedTo=me&status=open')}
                      className="action-btn action-btn-blue"
                    >
                      <span>Benim Açık Taleplerim</span>
                      <span className="action-count">{stats.myTickets}</span>
                    </button>
                    <button
                      onClick={() => navigate('/tickets?status=open')}
                      className="action-btn action-btn-green"
                    >
                      <span>Tüm Açık Talepler</span>
                      <span className="action-count">{stats.openTickets}</span>
                    </button>
                    <button
                      onClick={() => navigate('/chat')}
                      className="action-btn action-btn-purple"
                    >
                      <svg className="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>Canlı Chat</span>
                    </button>
                    <button
                      onClick={() => navigate('/stats')}
                      className="action-btn action-btn-orange"
                    >
                      <svg className="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>İstatistikler</span>
                    </button>
                    <button
                      onClick={() => navigate('/logs')}
                      className="action-btn action-btn-gray"
                    >
                      <svg className="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Loglar</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
