import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const JoinRoomModal = ({ show, room, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [cardsCount, setCardsCount] = useState(1);

  if (!show || !room) return null;

  const totalCost = room.card_cost * cardsCount;

  const handleJoin = async () => {
    setLoading(true);

    try {
      const response = await axios.post(`/api/bingo/v2/rooms/${room.code}/join`, {
        cards_count: cardsCount
      });

      if (response.data.success) {
        toast.success(`¡Te has unido a la sala!`);
        onSuccess(room.code);
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al unirse a la sala');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Unirse a Sala</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Info de la sala */}
          <div className="bg-white/5 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-white/60">Código:</span>
              <span className="text-white font-bold">{room.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Host:</span>
              <span className="text-white">{room.host_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Modo:</span>
              <span className="text-white">{room.mode} números</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Patrón:</span>
              <span className="text-white">{room.pattern_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Costo por cartón:</span>
              <span className="text-white">{room.card_cost} {room.currency_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Jugadores:</span>
              <span className="text-white">{room.player_count || 0}/{room.max_players}</span>
            </div>
          </div>

          {/* Selector de cartones */}
          <div>
            <label className="block text-white/80 mb-2">
              ¿Cuántos cartones quieres comprar?
            </label>
            <input
              type="number"
              value={cardsCount}
              onChange={(e) => setCardsCount(Math.max(1, Math.min(room.max_cards_per_player, parseInt(e.target.value) || 1)))}
              min="1"
              max={room.max_cards_per_player}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white text-center text-2xl"
            />
            <p className="text-white/60 text-sm text-center mt-2">
              Máximo {room.max_cards_per_player} cartones
            </p>
          </div>

          {/* Total */}
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-4 border border-purple-500/30">
            <div className="flex justify-between items-center">
              <span className="text-white font-bold text-lg">Total a pagar:</span>
              <span className="text-2xl font-bold text-white">
                {totalCost} {room.currency_type}
              </span>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg text-white rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {loading ? 'Uniéndose...' : 'Unirse'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinRoomModal;
