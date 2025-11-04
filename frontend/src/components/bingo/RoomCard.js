import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaUser, FaCoins, FaFire, FaTimes } from 'react-icons/fa';

const RoomCard = ({ room, onClick, user, onClose, isActive = false }) => {
  const [isClosing, setIsClosing] = useState(false);
  const isFull = (room.player_count || 0) >= room.max_players;
  const isInProgress = room.status === 'in_progress';
  
  // Verificar si el usuario es admin/tote
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('tote');
  const canClose = isAdmin && (room.status === 'waiting' || room.status === 'in_progress');

  const getCurrencyIcon = () => {
    return room.currency_type === 'coins' ? <FaCoins /> : <FaFire />;
  };

  const getStatusColor = () => {
    if (isInProgress) return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
    if (isFull) return 'bg-red-500/20 border-red-500/30 text-red-400';
    return 'bg-green-500/20 border-green-500/30 text-green-400';
  };

  const getStatusText = () => {
    if (isInProgress) return 'En juego';
    if (isFull) return 'Llena';
    return 'Esperando';
  };

  const handleCloseClick = async (e) => {
    e.stopPropagation(); // Evitar que se abra el modal de unirse
    
    if (!onClose) return;
    
    const confirmMessage = `⚠️ CERRAR SALA #${room.code}\n\nHost: ${room.host_name}\nEstado: ${getStatusText()}\nJugadores: ${room.player_count || 0}\n\n¿Continuar?`;
    
    if (!window.confirm(confirmMessage)) return;
    
    setIsClosing(true);
    try {
      await onClose(room.code);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => {
        // Si es sala activa, siempre permitir click
        if (isActive) {
          onClick();
        } else if (!isFull && !isInProgress) {
          onClick();
        }
      }}
      className={`glass-effect rounded-xl p-6 cursor-pointer transition-all relative ${
        isActive 
          ? 'ring-4 ring-purple-500 ring-opacity-70 shadow-2xl shadow-purple-500/50 hover:ring-purple-400'
          : (isFull || isInProgress) 
            ? 'opacity-60 cursor-not-allowed' 
            : 'hover:shadow-xl hover:shadow-purple-500/20'
      }`}
    >
      {/* Badge TU SALA si es sala activa */}
      {isActive && (
        <div className="absolute top-3 left-3 z-10 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-xs font-bold shadow-lg animate-pulse">
          🎮 TU SALA
        </div>
      )}

      {/* Admin Close Button */}
      {canClose && (
        <button
          onClick={handleCloseClick}
          disabled={isClosing}
          className="absolute top-3 right-3 z-10 w-8 h-8 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg"
          title="Cerrar sala (Admin)"
        >
          {isClosing ? '⏳' : <FaTimes />}
        </button>
      )}
      
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            Sala #{room.code}
          </h3>
          <p className="text-white/60 text-sm">
            Host: {room.host_name}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-white/60 text-xs mb-1">Modo</p>
          <p className="text-white font-bold">{room.mode} números</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-white/60 text-xs mb-1">Patrón</p>
          <p className="text-white font-bold capitalize">{room.pattern_type}</p>
        </div>
      </div>

      {/* Players */}
      <div className="flex items-center gap-2 mb-3">
        <FaUser className="text-white/60" />
        <div className="flex-1">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all"
              style={{ width: `${((room.player_count || 0) / room.max_players) * 100}%` }}
            />
          </div>
        </div>
        <span className="text-white/80 text-sm font-bold">
          {room.player_count || 0}/{room.max_players}
        </span>
      </div>

      {/* Cost */}
      <div className="flex items-center justify-between bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-3 border border-purple-500/30">
        <div className="flex items-center gap-2 text-white/80">
          {getCurrencyIcon()}
          <span className="text-sm">Costo por cartón</span>
        </div>
        <span className="text-white font-bold text-lg">
          {room.card_cost}
        </span>
      </div>

      {/* Pot if available */}
      {room.total_pot > 0 && (
        <div className="mt-3 text-center">
          <p className="text-white/60 text-xs">Pozo Acumulado</p>
          <p className="text-yellow-400 font-bold text-xl">
            {room.total_pot} {room.currency_type}
          </p>
        </div>
      )}

      {/* Disabled message */}
      {(isFull || isInProgress) && (
        <div className="mt-3 text-center text-white/60 text-sm">
          {isInProgress ? '⏳ Juego en progreso' : '🔒 Sala llena'}
        </div>
      )}
    </motion.div>
  );
};

export default RoomCard;
