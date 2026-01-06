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
  return (
  <>
        <Header />
      <div className="container">
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1>Business Kurulum</h1>
          {!isAddingNew && (
            <button
              onClick={() => setIsAddingNew(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              + Yeni Ekle
            </button>
          )}
        </div>

        {error && <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>}

        {/* Yeni Kayıt Ekleme Formu */}
        {isAddingNew && (
          <div
            style={{
              backgroundColor: '#f0f8ff',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '2px solid #4CAF50',
            }}
          >
            <h3>Yeni Kayıt Ekle</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Üye ID"
                value={newItem.memberId}
                onChange={(e) => setNewItem({ ...newItem, memberId: e.target.value })}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <select
                value={newItem.status}
                onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">Durum Seçin</option>
                <option value="Evrak bekleniyor">Evrak bekleniyor</option>
                <option value="Kurulum tamamlandı">Kurulum tamamlandı</option>
                <option value="Kurulum başarısız">Kurulum başarısız</option>
              </select>
              <input
                type="text"
                placeholder="Açıklama"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleCreate}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Kaydet
              </button>
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewItem({ memberId: '', status: '', description: '' });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div>Yükleniyor...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {items.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: isEditing ? '#fff9e6' : '#fff',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    border: isEditing ? '2px solid #ff9800' : '1px solid #e0e0e0',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                        Üye ID:
                      </label>
                      <input
                        type="text"
                        value={item.memberId}
                        onChange={(e) => handleFieldChange(item.id, 'memberId', e.target.value)}
                        disabled={!isEditing}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          backgroundColor: isEditing ? '#fff' : '#f5f5f5',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                        Durum:
                      </label>
                      <select
                        value={item.status}
                        onChange={(e) => handleFieldChange(item.id, 'status', e.target.value)}
                        disabled={!isEditing}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          backgroundColor: isEditing ? '#fff' : '#f5f5f5',
                        }}
                      >
                        <option value="Evrak bekleniyor">Evrak bekleniyor</option>
                        <option value="Kurulum tamamlandı">Kurulum tamamlandı</option>
                        <option value="Kurulum başarısız">Kurulum başarısız</option>
                      </select>
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                        Açıklama:
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                        disabled={!isEditing}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          backgroundColor: isEditing ? '#fff' : '#f5f5f5',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
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
                            padding: '8px 16px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Kaydet
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#999',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          İptal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(item)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Sil
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
    </>
  );
}
