import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

interface ChatMessage {
  id: string;
  fromType: 'agent' | 'user';
  fromName: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface ChatModalProps {
  ticketId: string;
  onClose: () => void;
  userName: string;
}

export default function ChatModal({ ticketId, onClose, userName }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res = await api<{ messages: any[] }>(`/chat/chat-history/${ticketId}`);
      setMessages(res.messages.map((m: any) => ({
        id: m._id,
        fromType: m.fromType,
        fromName: m.fromName,
        message: m.message,
        timestamp: m.timestamp,
        read: m.read
      })));
      setTimeout(scrollToBottom, 100);
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000); // Her 5 saniyede güncelle
    return () => clearInterval(interval);
  }, [ticketId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      setSending(true);
      await api('/chat/send-message', {
        method: 'POST',
        body: JSON.stringify({
          ticketId,
          message: newMessage
        })
      });
      setNewMessage('');
      await loadMessages();
    } catch (e: any) {
      alert(e.message || 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '600px',
          height: '80vh',
          background: 'var(--surface)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--card)'
        }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>
              💬 {userName}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Telegram üzerinden mesajlaşın
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Messages */}
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
              Henüz mesaj yok. İlk mesajı gönderin!
            </div>
          )}
          
          {messages.map((msg) => (
            <div 
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.fromType === 'agent' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '16px',
                background: msg.fromType === 'agent' 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'var(--glass)',
                color: msg.fromType === 'agent' ? '#fff' : 'var(--text)',
                border: msg.fromType === 'user' ? '1px solid var(--border)' : 'none',
                boxShadow: msg.fromType === 'agent' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '4px', opacity: 0.9 }}>
                  {msg.fromName}
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {msg.message}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  marginTop: '4px', 
                  opacity: 0.7,
                  textAlign: 'right'
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
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
      </div>
    </div>
  );
}
