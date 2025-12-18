import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { me } from '../auth';
import Header from '../Components/Header';
import { Modal } from '../Components/Modal';
import type { Ticket } from '../types';

interface ChatUser {
  // Direct chat için
  chatId?: number;
  // Ticket chat için
  ticketId?: string;
  userChatId?: number;
  
  userId: number;
  userName: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  lastMessage: {
    message: string;
    fromType: 'agent' | 'user';
    fromName: string;
    timestamp: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
  
  // Ticket bilgisi
  ticket?: {
    ticketId: string;
    status: string;
    assignedTo: string;
    detay?: string;
  };
  
  // Chat tipi
  chatType: 'direct' | 'ticket';
}

interface ChatMessage {
  _id: string;
  fromType: 'agent' | 'user';
  fromId: string;
  fromName: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function Chat() {
  const user = me();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ticket modal state
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Kullanıcıları yükle - hem direct hem ticket
  const loadUsers = async () => {
    try {
      // Direct chat kullanıcıları
      const directRes = await api<{ users: any[] }>('/chat/direct-users');
      const directUsers: ChatUser[] = directRes.users.map(u => ({
        chatId: u.chatId,
        userId: u.userId,
        userName: u.userName,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        lastMessage: u.lastMessage,
        unreadCount: u.unreadCount,
        updatedAt: u.updatedAt,
        ticket: u.ticket,
        chatType: 'direct' as const
      }));

      // Ticket chat kullanıcıları
      const ticketRes = await api<{ users: any[] }>('/chat/users');
      const ticketUsers: ChatUser[] = ticketRes.users.map(u => ({
        ticketId: u.ticketId,
        userChatId: u.userChatId,
        userId: u.userId,
        userName: u.userName,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        lastMessage: u.lastMessage,
        unreadCount: u.unreadCount,
        updatedAt: u.updatedAt,
        ticket: {
          ticketId: u.ticketId,
          status: u.status,
          assignedTo: u.assignedTo,
          detay: ''
        },
        chatType: 'ticket' as const
      }));

      // Birleştir ve tekrarları kaldır (userId'ye göre)
      const allUsers = [...directUsers, ...ticketUsers];
      const uniqueUsers = allUsers.reduce((acc, current) => {
        const exists = acc.find(u => u.userId === current.userId);
        if (!exists) {
          acc.push(current);
        } else {
          // Ticket varsa ticket versiyonunu tercih et
          if (current.chatType === 'ticket' && exists.chatType === 'direct') {
            const index = acc.findIndex(u => u.userId === current.userId);
            acc[index] = current;
          }
        }
        return acc;
      }, [] as ChatUser[]);

      // Tarihe göre sırala
      uniqueUsers.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setUsers(uniqueUsers);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  // Mesajları yükle
  const loadMessages = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      
      if (selectedUser.chatType === 'direct') {
        // Direct chat mesajları
        const res = await api<{ messages: ChatMessage[] }>(`/chat/direct-history/${selectedUser.chatId}`);
        setMessages(res.messages);
        
        // Mesajları okundu işaretle
        await api(`/chat/direct-mark-read/${selectedUser.chatId}`, {
          method: 'POST'
        });
      } else {
        // Ticket chat mesajları
        const res = await api<{ messages: ChatMessage[] }>(`/chat/chat-history/${selectedUser.ticketId}`);
        setMessages(res.messages);
        
        // Mesajları okundu işaretle
        await api(`/chat/mark-read/${selectedUser.ticketId}`, {
          method: 'POST'
        });
      }
      
      setTimeout(scrollToBottom, 100);
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setLoading(false);
    }
  };

  // İlk yükleme
  useEffect(() => {
    loadUsers();
    const interval = setInterval(loadUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Seçili chat değiştiğinde mesajları yükle
  useEffect(() => {
    if (selectedUser) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUser]);

  // Mesaj gönder
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    
    try {
      setSending(true);
      
      if (selectedUser.chatType === 'direct') {
        await api('/chat/direct-send', {
          method: 'POST',
          body: JSON.stringify({
            chatId: selectedUser.chatId,
            message: newMessage
          })
        });
      } else {
        await api('/chat/send-message', {
          method: 'POST',
          body: JSON.stringify({
            ticketId: selectedUser.ticketId,
            message: newMessage
          })
        });
      }
      
      setNewMessage('');
      await loadMessages();
    } catch (e: any) {
      alert(e.message || 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  // Ticket detayını görüntüle
  const viewTicket = async (ticketId: string) => {
    try {
      const ticket = await api<any>(`/tickets/${ticketId}`);
      // API'den gelen veriyi Ticket tipine dönüştür
      const formattedTicket: Ticket = {
        id: ticket.id,
        status: ticket.status,
        telegram: ticket.telegram,
        assignedTo: ticket.assignedTo,
        assignedAt: ticket.assignedAt,
        resolutionText: ticket.resolutionText,
        interestedBy: ticket.interestedBy,
        interestedAt: ticket.interestedAt,
        updatedAt: ticket.updatedAt,
        createdAt: ticket.createdAt
      };
      setViewingTicket(formattedTicket);
      setTicketModalOpen(true);
    } catch (e) {
      console.error('Failed to load ticket:', e);
      alert('Ticket detayı yüklenemedi');
    }
  };

  return (
    <>
      <Header />
      <div style={{
        display: 'flex',
        height: 'calc(100vh - 60px)',
        background: 'var(--bg)',
        overflow: 'hidden'
      }}>
        {/* Sol Panel */}
        <div style={{
          width: '350px',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)'
        }}>
          {/* Yeni Mesaj Bildirimi */}
          {users.reduce((total, u) => total + u.unreadCount, 0) > 0 && (
            <div style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              fontWeight: '700',
              fontSize: '14px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              🔔 {users.reduce((total, u) => total + u.unreadCount, 0)} Yeni Mesaj
            </div>
          )}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)'
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>
              💬 Sohbetler
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
              {users.length} kullanıcı
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {users.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                Henüz sohbet yok
              </div>
            )}

            {users.map((u) => (
              <div
                key={u.chatType === 'direct' ? `direct-${u.chatId}` : `ticket-${u.ticketId}`}
                onClick={() => setSelectedUser(u)}
                style={{
                  padding: '12px 16px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  background: selectedUser === u ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                  borderLeft: selectedUser === u ? '4px solid #667eea' : '4px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
                  color: '#5e72e4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '16px',
                  flexShrink: 0
                }}>
                  {u.firstName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '4px'
                  }}>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {u.firstName} {u.lastName}
                    </span>
                    {u.unreadCount > 0 && (
                      <span style={{
                        background: '#667eea',
                        color: '#fff',
                        minWidth: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 6px'
                      }}>
                        {u.unreadCount}
                      </span>
                    )}
                  </div>

                  {u.lastMessage && (
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {u.lastMessage.fromType === 'agent' && <span style={{ color: '#667eea' }}>✓</span>}
                      {u.lastMessage.message}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sağ Panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)'
        }}>
          {!selectedUser ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              fontSize: '16px'
            }}>
              Bir sohbet seçin
            </div>
          ) : (
            <>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '14px'
                  }}>
                    {selectedUser?.firstName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>
                      {selectedUser?.firstName} {selectedUser?.lastName}
                    </h3>
                    {selectedUser?.firstName && (
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                        @{selectedUser.firstName}
                      </p>
                    )}
                  </div>
                </div>

                {(selectedUser?.ticket || selectedUser?.chatType === 'ticket') && (
                  <button
                    onClick={() => {
                      const ticketId = selectedUser.chatType === 'ticket' 
                        ? selectedUser.ticketId! 
                        : selectedUser.ticket!.ticketId;
                      viewTicket(ticketId);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    📋 Konuyu Gör
                  </button>
                )}
              </div>

              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {loading && messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                    Yükleniyor...
                  </div>
                )}

                {!loading && messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                    Henüz mesaj yok
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg._id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.fromType === 'agent' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '70%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: '16px',
                        background: msg.fromType === 'agent'
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'var(--glass)',
                        color: msg.fromType === 'agent' ? '#fff' : 'var(--text)',
                        border: msg.fromType === 'user' ? '1px solid var(--border)' : 'none',
                        boxShadow: msg.fromType === 'agent' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          marginBottom: '4px',
                          opacity: 0.9,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {msg.fromType === 'agent' ? '👤' : '💬'} {msg.fromName}
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </div>
                        <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7, textAlign: 'right' }}>
                          {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      {/* Eğer ticket chat'ten geliyorsa Konu butonu göster */}
                      {selectedUser?.chatType === 'ticket' && msg.fromType === 'agent' && (
                        <button
                          onClick={() => {
                            const ticketId = selectedUser.ticketId!;
                            viewTicket(ticketId);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--glass)',
                            color: 'var(--text)',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            alignSelf: msg.fromType === 'agent' ? 'flex-end' : 'flex-start',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--border)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--glass)';
                          }}
                        >
                          📋 Konu
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                gap: '12px'
              }}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Mesajınızı yazın..."
                  disabled={sending}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: sending || !newMessage.trim()
                      ? 'var(--glass)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    boxShadow: sending || !newMessage.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  {sending ? '...' : 'Gönder'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {ticketModalOpen && viewingTicket && (
        <Modal onClose={() => setTicketModalOpen(false)}>
          <div style={{ padding: '24px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '22px', fontWeight: '700', color: 'var(--text)' }}>
              📋 Ticket Detayı
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', fontWeight: '600' }}>Durum</div>
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--border)', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                  {viewingTicket.status === 'open' && '🟢 Açık'}
                  {viewingTicket.status === 'resolved' && '✅ Çözüldü'}
                  {viewingTicket.status === 'unreachable' && '📵 Ulaşılamıyor'}
                  {viewingTicket.status === 'reported' && '🚨 Raporlandı'}
                  {viewingTicket.status === 'waiting' && '⏳ Beklemede'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', fontWeight: '600' }}>Atanan</div>
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text)' }}>
                  {viewingTicket.assignedTo || 'Atanmamış'}
                </div>
              </div>
              {viewingTicket.telegram?.text && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', fontWeight: '600' }}>Mesaj</div>
                  <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--border)', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                    {viewingTicket.telegram.text}
                  </div>
                </div>
              )}
              {viewingTicket.telegram?.from && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', fontWeight: '600' }}>Kullanıcı</div>
                  <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--glass)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text)' }}>
                    <div>👤 {viewingTicket.telegram.from.displayName}</div>
                    {viewingTicket.telegram.from.username && (
                      <div style={{ marginTop: '4px', color: 'var(--muted)' }}>@{viewingTicket.telegram.from.username}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setTicketModalOpen(false)}
                style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Kapat
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
