import { useEffect, useState } from 'react';
import { businessSetupAPI } from '../api';
import type { BusinessSetup } from '../types';
import Header from '../Components/Header';

export default function BusinessSetupPage() {
  const [items, setItems] = useState<BusinessSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ memberId: '', status: '', description: '' });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      const data = await businessSetupAPI.getAll();
      setItems(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newItem.memberId.trim() || !newItem.status.trim() || !newItem.description.trim()) {
      alert('Tüm alanları doldurun');
      return;
    }
    try {
      await businessSetupAPI.create(newItem);
      setNewItem({ memberId: '', status: '', description: '' });
      setIsAddingNew(false);
      loadItems();
    } catch (err: any) {
      alert(err.message || 'Ekleme hatası');
    }
  }

  async function handleUpdate(id: string, updates: Partial<BusinessSetup>) {
    try {
      await businessSetupAPI.update(id, updates);
      loadItems();
      setEditingId(null);
    } catch (err: any) {
      alert(err.message || 'Güncelleme hatası');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return;
    try {
      await businessSetupAPI.delete(id);
      loadItems();
    } catch (err: any) {
      alert(err.message || 'Silme hatası');
    }
  }

  function handleEdit(item: BusinessSetup) {
    setEditingId(item.id);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  function handleFieldChange(id: string, field: keyof BusinessSetup, value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'Kurulum tamamlandı':
        return '#10b981';
      case 'Evrak bekleniyor':
        return '#f59e0b';
      case 'Kurulum başarısız':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'Kurulum tamamlandı':
        return '✅';
      case 'Evrak bekleniyor':
        return '⏳';
      case 'Kurulum başarısız':
        return '❌';
      default:
        return '📋';
    }
  }

  function formatDate(dateString?: string) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  const filteredItems = items.filter(item =>
    item.memberId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
  <>
    <Header />
    <div className="container">
      <div style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header Section */}
        <div style={{
          marginBottom: '32px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '32px',
          borderRadius: '16px',
          color: 'white',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
                🏢 Business Kurulum Yönetimi
              </h1>
              <p style={{ margin: 0, opacity: 0.9, fontSize: '16px' }}>
                Toplam {items.length} kayıt
              </p>
            </div>
            <button
              onClick={() => setIsAddingNew(true)}
              style={{
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '20px' }}>+</span> Yeni Kayıt Ekle
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ marginTop: '24px' }}>
            <input
              type="text"
              placeholder="🔍 Üye ID, durum veya açıklamaya göre ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '12px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                color: 'white',
                fontSize: '15px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid #fcc',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Yeni Kayıt Ekleme Formu */}
        {isAddingNew && (
          <div
            style={{
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              padding: '28px',
              borderRadius: '16px',
              marginBottom: '24px',
              border: '2px solid #0ea5e9',
              boxShadow: '0 8px 32px rgba(14, 165, 233, 0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 20px 0', color: '#0c4a6e', fontSize: '20px', fontWeight: '700' }}>
              ✨ Yeni Kayıt Ekle
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#0c4a6e', fontSize: '14px' }}>
                  Üye ID
                </label>
                <input
                  type="text"
                  placeholder="Örn: 12345"
                  value={newItem.memberId}
                  onChange={(e) => setNewItem({ ...newItem, memberId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid #cbd5e1',
                    fontSize: '15px',
                    transition: 'all 0.3s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#0ea5e9'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#0c4a6e', fontSize: '14px' }}>
                  Durum
                </label>
                <select
                  value={newItem.status}
                  onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid #cbd5e1',
                    fontSize: '15px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="">Durum Seçin</option>
                  <option value="Evrak bekleniyor">⏳ Evrak bekleniyor</option>
                  <option value="Kurulum tamamlandı">✅ Kurulum tamamlandı</option>
                  <option value="Kurulum başarısız">❌ Kurulum başarısız</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#0c4a6e', fontSize: '14px' }}>
                  Açıklama
                </label>
                <input
                  type="text"
                  placeholder="Detaylı açıklama giriniz..."
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid #cbd5e1',
                    fontSize: '15px',
                    outline: 'none',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#0ea5e9'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleCreate}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                💾 Kaydet
              </button>
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewItem({ memberId: '', status: '', description: '' });
                }}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                ❌ İptal
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px',
            fontSize: '18px',
            color: '#64748b',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid #e2e8f0',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <span>Yükleniyor...</span>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            borderRadius: '16px',
            color: '#64748b',
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Kayıt Bulunamadı</h3>
            <p style={{ margin: 0 }}>
              {searchQuery ? 'Arama kriterlerinize uygun kayıt bulunamadı.' : 'Henüz hiç kayıt eklenmemiş.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredItems.map((item) => {
              const isEditing = editingId === item.id;
              const statusColor = getStatusColor(item.status);
              const statusIcon = getStatusIcon(item.status);
              
              return (
                <div
                  key={item.id}
                  style={{
                    background: isEditing 
                      ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' 
                      : 'white',
                    padding: '24px',
                    borderRadius: '16px',
                    boxShadow: isEditing 
                      ? '0 8px 32px rgba(251, 191, 36, 0.25)' 
                      : '0 2px 12px rgba(0,0,0,0.08)',
                    border: isEditing ? '2px solid #f59e0b' : '2px solid transparent',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isEditing) e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isEditing) e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
                  }}
                >
                  {/* Header with Status Badge */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${statusColor}22 0%, ${statusColor}44 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                      }}>
                        {statusIcon}
                      </div>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          color: '#64748b',
                          fontWeight: '500',
                          marginBottom: '4px',
                        }}>
                          Üye ID
                        </div>
                        <div style={{
                          fontSize: '20px',
                          fontWeight: '700',
                          color: '#1e293b',
                        }}>
                          #{item.memberId}
                        </div>
                      </div>
                    </div>
                    {!isEditing && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        background: `linear-gradient(135deg, ${statusColor}15 0%, ${statusColor}25 100%)`,
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: statusColor,
                        border: `2px solid ${statusColor}33`,
                      }}>
                        <span>{statusIcon}</span>
                        <span>{item.status}</span>
                      </div>
                    )}
                  </div>

                  {/* Form Fields */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '20px',
                    marginBottom: '20px',
                  }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#475569',
                        fontSize: '14px',
                      }}>
                        📝 Üye ID
                      </label>
                      <input
                        type="text"
                        value={item.memberId}
                        onChange={(e) => handleFieldChange(item.id, 'memberId', e.target.value)}
                        disabled={!isEditing}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: isEditing ? '2px solid #cbd5e1' : '2px solid #e2e8f0',
                          backgroundColor: isEditing ? '#fff' : '#f8fafc',
                          fontSize: '15px',
                          color: '#1e293b',
                          outline: 'none',
                          transition: 'all 0.3s ease',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#475569',
                        fontSize: '14px',
                      }}>
                        🎯 Durum
                      </label>
                      <select
                        value={item.status}
                        onChange={(e) => handleFieldChange(item.id, 'status', e.target.value)}
                        disabled={!isEditing}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: isEditing ? '2px solid #cbd5e1' : '2px solid #e2e8f0',
                          backgroundColor: isEditing ? '#fff' : '#f8fafc',
                          fontSize: '15px',
                          color: '#1e293b',
                          cursor: isEditing ? 'pointer' : 'not-allowed',
                          outline: 'none',
                        }}
                      >
                        <option value="Evrak bekleniyor">⏳ Evrak bekleniyor</option>
                        <option value="Kurulum tamamlandı">✅ Kurulum tamamlandı</option>
                        <option value="Kurulum başarısız">❌ Kurulum başarısız</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{
                        display: 'block',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#475569',
                        fontSize: '14px',
                      }}>
                        💬 Açıklama
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                        disabled={!isEditing}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: isEditing ? '2px solid #cbd5e1' : '2px solid #e2e8f0',
                          backgroundColor: isEditing ? '#fff' : '#f8fafc',
                          fontSize: '15px',
                          color: '#1e293b',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Meta Information */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '10px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#64748b',
                  }}>
                    {item.createdBy && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>👤</span>
                        <span style={{ fontWeight: '600' }}>Oluşturan:</span>
                        <span style={{ color: '#667eea', fontWeight: '600' }}>
                          {item.createdBy.name} (#{item.createdBy.externalUserId})
                        </span>
                      </div>
                    )}
                    {item.updatedBy && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>✏️</span>
                        <span style={{ fontWeight: '600' }}>Güncelleyen:</span>
                        <span style={{ color: '#764ba2', fontWeight: '600' }}>
                          {item.updatedBy.name} (#{item.updatedBy.externalUserId})
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📅</span>
                      <span style={{ fontWeight: '600' }}>Oluşturulma:</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    {item.updatedAt && item.updatedAt !== item.createdAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔄</span>
                        <span style={{ fontWeight: '600' }}>Güncelleme:</span>
                        <span>{formatDate(item.updatedAt)}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() =>
                            handleUpdate(item.id, {
                              memberId: item.memberId,
                              status: item.status,
                              description: item.description,
                            })
                          }
                          style={{
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.3s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          💾 Kaydet
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px',
                            boxShadow: '0 4px 12px rgba(148, 163, 184, 0.3)',
                            transition: 'all 0.3s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          ❌ İptal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(item)}
                          style={{
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                            transition: 'all 0.3s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          ✏️ Düzenle
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                            transition: 'all 0.3s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          🗑️ Sil
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* Spinning animation */}
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
    </>
  );
}
