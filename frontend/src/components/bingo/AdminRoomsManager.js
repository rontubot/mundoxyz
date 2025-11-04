import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AdminRoomsManager.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://confident-bravery-production-ce7b.up.railway.app';

const AdminRoomsManager = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closingRoom, setClosingRoom] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' o 'finished'
  const [searchCode, setSearchCode] = useState('');

  // Verificar si el usuario es admin/tote
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('tote');

  useEffect(() => {
    if (isAdmin) {
      loadRooms();
    }
  }, [isAdmin]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/bingo/v2/my-rooms`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      } else if (response.status === 403) {
        console.warn('Acceso denegado al panel de administración');
      } else {
        console.error('Error loading rooms');
      }
    } catch (error) {
      console.error('Error loading admin rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRoom = async (room) => {
    // Confirmación con información detallada
    const confirmMessage = room.players_with_cards > 0
      ? `⚠️ CERRAR SALA #${room.code}\n\n` +
        `Host: ${room.host_name}\n` +
        `Estado: ${room.status}\n` +
        `Jugadores con cartones: ${room.players_with_cards}\n` +
        `Total a reembolsar: ${room.total_collected || 0} ${room.currency_type}\n\n` +
        `Esta acción NO se puede deshacer.\n` +
        `¿Continuar?`
      : `⚠️ CERRAR SALA #${room.code}\n\n` +
        `Host: ${room.host_name}\n` +
        `Estado: ${room.status}\n` +
        `Sin jugadores con cartones.\n\n` +
        `¿Continuar?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setClosingRoom(room.code);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${room.code}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ ${data.message || 'Sala cerrada exitosamente'}`);
        loadRooms(); // Recargar lista
      } else {
        alert(`❌ ${data.error || 'No se pudo cerrar la sala'}`);
      }
    } catch (error) {
      console.error('Error closing room:', error);
      alert('❌ Error al cerrar la sala');
    } finally {
      setClosingRoom(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      waiting: { text: 'Esperando', color: '#ffc107' },
      in_progress: { text: 'En Juego', color: '#28a745' },
      finished: { text: 'Finalizada', color: '#6c757d' },
      cancelled: { text: 'Cancelada', color: '#dc3545' }
    };

    const badge = badges[status] || { text: status, color: '#6c757d' };

    return (
      <span 
        className="status-badge" 
        style={{ backgroundColor: badge.color }}
      >
        {badge.text}
      </span>
    );
  };

  const canCloseRoom = (room) => {
    return room.status === 'waiting' || room.status === 'in_progress';
  };

  // Filtrar salas por pestaña activa
  const activeRooms = rooms.filter(r => r.status === 'waiting' || r.status === 'in_progress');
  const finishedRooms = rooms.filter(r => r.status === 'finished' || r.status === 'cancelled');

  // Aplicar búsqueda por código
  const filteredRooms = (activeTab === 'active' ? activeRooms : finishedRooms).filter(room => {
    if (!searchCode) return true;
    return room.code.toString().includes(searchCode);
  });

  // No mostrar nada si no es admin
  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return <div className="admin-rooms-manager loading">Cargando salas...</div>;
  }

  return (
    <div className="admin-rooms-manager">
      <div className="admin-header">
        <h3>🔧 Salas de Bingo (Administración)</h3>
        <p className="subtitle">Panel de administración global - Solo tote/admin</p>
      </div>

      {/* Buscador */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por código de sala..."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          className="search-input"
        />
        {searchCode && (
          <button 
            onClick={() => setSearchCode('')}
            className="clear-search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          🎮 Activas ({activeRooms.length})
        </button>
        <button
          className={`tab ${activeTab === 'finished' ? 'active' : ''}`}
          onClick={() => setActiveTab('finished')}
        >
          📜 Terminadas ({finishedRooms.length})
        </button>
      </div>

      {/* Lista de salas */}
      {filteredRooms.length === 0 ? (
        <div className="empty-state">
          {searchCode 
            ? `No se encontraron salas con código "${searchCode}"`
            : `No hay salas ${activeTab === 'active' ? 'activas' : 'terminadas'}`
          }
        </div>
      ) : (
        <div className="rooms-grid">
          {filteredRooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-header">
                <div className="room-code">
                  <span className="code-label">Sala</span>
                  <span className="code-value">#{room.code}</span>
                </div>
                {getStatusBadge(room.status)}
                {canCloseRoom(room) && (
                  <button
                    className="close-room-btn"
                    onClick={() => handleCloseRoom(room)}
                    disabled={closingRoom === room.code}
                    title="Cerrar sala y reembolsar (Admin)"
                  >
                    {closingRoom === room.code ? '⏳' : '✕'}
                  </button>
                )}
              </div>

              <div className="room-details">
                <div className="detail-row host-row">
                  <span className="detail-label">👤 Host:</span>
                  <span className="detail-value">{room.host_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Modo:</span>
                  <span className="detail-value">{room.mode} números</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Patrón:</span>
                  <span className="detail-value">{room.winning_pattern}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Precio:</span>
                  <span className="detail-value">{room.card_price} {room.currency_type}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Jugadores:</span>
                  <span className="detail-value">
                    {room.player_count} ({room.players_with_cards} con cartones)
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Pozo:</span>
                  <span className="detail-value prize">
                    {room.prize_pool} {room.currency_type}
                  </span>
                </div>
              </div>

              <div className="room-footer">
                <span className="room-date">
                  Creada: {new Date(room.created_at).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                {room.finished_at && (
                  <span className="room-date">
                    Finalizada: {new Date(room.finished_at).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRoomsManager;
