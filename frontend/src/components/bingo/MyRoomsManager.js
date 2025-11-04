import React, { useState, useEffect } from 'react';
import './MyRoomsManager.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://confident-bravery-production-ce7b.up.railway.app';

const MyRoomsManager = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closingRoom, setClosingRoom] = useState(null);

  useEffect(() => {
    loadMyRooms();
  }, []);

  const loadMyRooms = async () => {
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
        setRooms(data.rooms);
      } else {
        console.error('Error loading rooms');
      }
    } catch (error) {
      console.error('Error loading my rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRoom = async (room) => {
    // Validar primero si puede cerrar
    const canClose = await checkCanClose(room.code);
    
    if (!canClose.allowed) {
      alert(`No se puede cerrar: ${canClose.reason}`);
      return;
    }

    // Confirmación con información detallada
    const confirmMessage = room.players_with_cards > 0
      ? `¿Cerrar sala #${room.code}?\n\n` +
        `Se reembolsará a ${room.players_with_cards} jugador(es)\n` +
        `Total: ${room.total_collected || 0} ${room.currency_type}\n\n` +
        `Esta acción NO se puede deshacer.`
      : `¿Cerrar sala #${room.code}?\n\nNo hay jugadores con cartones comprados.`;

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
        alert(data.message || 'Sala cerrada exitosamente');
        loadMyRooms(); // Recargar lista
      } else {
        alert(data.error || 'No se pudo cerrar la sala');
      }
    } catch (error) {
      console.error('Error closing room:', error);
      alert('Error al cerrar la sala');
    } finally {
      setClosingRoom(null);
    }
  };

  const checkCanClose = async (code) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}/can-close`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
      
      return { allowed: false, reason: 'Error al verificar permisos' };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return { allowed: false, reason: 'Error de conexión' };
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

  if (loading) {
    return <div className="my-rooms-manager loading">Cargando salas...</div>;
  }

  if (rooms.length === 0) {
    return (
      <div className="my-rooms-manager empty">
        <p>No tienes salas creadas</p>
      </div>
    );
  }

  return (
    <div className="my-rooms-manager">
      <h3>🎰 Mis Salas de Bingo</h3>
      <p className="subtitle">Administra tus salas activas</p>

      <div className="rooms-list">
        {rooms.map(room => (
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
                  title="Cerrar sala y reembolsar"
                >
                  {closingRoom === room.code ? '⏳' : '✕'}
                </button>
              )}
            </div>

            <div className="room-details">
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
                Creada: {new Date(room.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyRoomsManager;
