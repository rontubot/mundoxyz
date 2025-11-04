import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FaPlus, FaFilter, FaSearch } from 'react-icons/fa';
import CreateRoomModal from '../components/bingo/CreateRoomModal';
import JoinRoomModal from '../components/bingo/JoinRoomModal';
import RoomCard from '../components/bingo/RoomCard';

const BingoLobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [filters, setFilters] = useState({
    currency: 'all',
    mode: 'all',
    search: ''
  });

  // Obtener salas públicas
  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['bingo-rooms', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.currency !== 'all') params.append('currency', filters.currency);
      if (filters.mode !== 'all') params.append('mode', filters.mode);
      
      const response = await axios.get(`/api/bingo/v2/rooms?${params}`);
      return response.data.rooms;
    },
    refetchInterval: 5000
  });

  // Obtener salas activas del usuario (donde tiene cartones comprados)
  const { data: activeRooms = [] } = useQuery({
    queryKey: ['active-bingo-rooms', user?.id],
    queryFn: async () => {
      const response = await axios.get('/api/bingo/v2/active-rooms');
      return response.data.rooms || [];
    },
    enabled: !!user,
    refetchInterval: 10000
  });

  // Handler para limpiar sala problemática
  const handleClearRoom = async () => {
    try {
      await axios.post('/api/bingo/clear-my-room');
      toast.success('Sala limpiada exitosamente');
      queryClient.invalidateQueries(['bingo-rooms']);
    } catch (error) {
      console.error('Error limpiando sala:', error);
      toast.error('Error al limpiar sala');
    }
  };

  // Efecto para notificar salas activas
  useEffect(() => {
    if (activeRooms.length > 0) {
      const activeCount = activeRooms.length;
      const firstRoom = activeRooms[0];
      
      toast(
        <div className="flex flex-col gap-2">
          <span className="font-bold">
            🎰 {activeCount === 1 
              ? `Tienes una sala activa: #${firstRoom.code}` 
              : `Tienes ${activeCount} salas activas`
            }
          </span>
          {activeCount === 1 ? (
            <button
              onClick={() => {
                const path = firstRoom.status === 'waiting' 
                  ? `/bingo/v2/room/${firstRoom.code}`
                  : `/bingo/v2/play/${firstRoom.code}`;
                navigate(path);
              }}
              className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm hover:from-purple-700 hover:to-pink-700 font-semibold"
            >
              Volver a Sala #{firstRoom.code}
            </button>
          ) : (
            <div className="text-xs text-gray-300">
              Busca las salas resaltadas en 🟣 morado abajo
            </div>
          )}
        </div>,
        {
          duration: 8000,
          position: 'top-center',
          icon: '🎮'
        }
      );
    }
  }, [activeRooms, navigate]);

  // Función helper para verificar si una sala está activa
  const isActiveRoom = (roomCode) => {
    return activeRooms.some(ar => ar.code === roomCode);
  };

  const handleRoomClick = (room) => {
    // Verificar si el usuario ya está jugando en esta sala
    const isAlreadyPlaying = activeRooms.some(ar => ar.code === room.code);
    
    if (isAlreadyPlaying) {
      // Ya está jugando, redirigir directo a la sala
      const activeRoom = activeRooms.find(ar => ar.code === room.code);
      const path = activeRoom.status === 'waiting' 
        ? `/bingo/v2/room/${room.code}`
        : `/bingo/v2/play/${room.code}`;
      
      toast.success(`Volviendo a tu sala #${room.code}`);
      navigate(path);
    } else {
      // No está jugando, mostrar modal de compra
      setSelectedRoom(room);
      setShowJoinModal(true);
    }
  };

  const handleJoinSuccess = (code) => {
    queryClient.invalidateQueries(['bingo-rooms']);
    navigate(`/bingo/v2/room/${code}`);
  };

  const handleCreateSuccess = (code) => {
    queryClient.invalidateQueries(['bingo-rooms']);
    navigate(`/bingo/v2/room/${code}`);
  };

  const handleCloseRoom = async (roomCode) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://confident-bravery-production-ce7b.up.railway.app'}/api/bingo/v2/rooms/${roomCode}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Sala cerrada exitosamente');
        queryClient.invalidateQueries(['bingo-rooms']);
      } else {
        toast.error(data.error || 'No se pudo cerrar la sala');
      }
    } catch (error) {
      console.error('Error closing room:', error);
      toast.error('Error al cerrar la sala');
    }
  };

  // Filtrar salas
  const filteredRooms = rooms.filter(room => 
    filters.search === '' || 
    room.code.toLowerCase().includes(filters.search.toLowerCase()) ||
    room.host_name.toLowerCase().includes(filters.search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Header */}
      <div className="glass-effect sticky top-0 z-40 border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/games')}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                ←
              </button>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-4xl">🎰</span>
                Bingo Lobby
              </h1>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 
                       text-white rounded-xl font-bold hover:shadow-lg 
                       hover:shadow-purple-500/25 transition-all transform hover:scale-105
                       flex items-center gap-2"
            >
              <FaPlus /> Crear Sala
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="container mx-auto px-4 py-6">
        <div className="glass-effect p-4 rounded-xl">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <FaFilter className="text-white/60" />
              <span className="text-white/80 font-semibold">Filtros:</span>
            </div>
            
            {/* Filtro de moneda */}
            <select
              value={filters.currency}
              onChange={(e) => setFilters({...filters, currency: e.target.value})}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg 
                       text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas las monedas</option>
              <option value="coins">Solo Monedas</option>
              <option value="fires">Solo Fuegos</option>
            </select>

            {/* Filtro de modo */}
            <select
              value={filters.mode}
              onChange={(e) => setFilters({...filters, mode: e.target.value})}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg 
                       text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los modos</option>
              <option value="75">75 números</option>
              <option value="90">90 números</option>
            </select>

            {/* Búsqueda */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar por código o host..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 
                           rounded-lg text-white placeholder-white/40
                           focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de salas */}
      <div className="container mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="glass-effect p-12 rounded-xl text-center">
            <div className="text-6xl mb-4">🎲</div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {rooms.length === 0 ? 'No hay salas disponibles' : 'No hay salas que coincidan'}
            </h3>
            <p className="text-white/60 mb-6">
              {rooms.length === 0 
                ? '¡Sé el primero en crear una sala de Bingo!' 
                : 'Prueba con otros filtros'}
            </p>
            {rooms.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 
                         text-white rounded-xl font-bold hover:shadow-lg 
                         hover:shadow-purple-500/25 transition-all"
              >
                Crear Primera Sala
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map(room => (
              <RoomCard 
                key={room.id} 
                room={room} 
                onClick={() => handleRoomClick(room)}
                user={user}
                onClose={handleCloseRoom}
                isActive={isActiveRoom(room.code)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      <CreateRoomModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      <JoinRoomModal
        show={showJoinModal}
        room={selectedRoom}
        onClose={() => {
          setShowJoinModal(false);
          setSelectedRoom(null);
        }}
        onSuccess={handleJoinSuccess}
      />
    </div>
  );
};

export default BingoLobby;
