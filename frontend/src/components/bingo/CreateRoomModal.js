import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const CreateRoomModal = ({ show, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    mode: '75',
    pattern_type: 'line',
    card_cost: 100,
    currency_type: 'coins',
    max_players: 30,
    max_cards_per_player: 10,
    is_public: true
  });

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post('/api/bingo/v2/rooms', config);
      
      if (response.data.success) {
        toast.success('¡Sala creada exitosamente!');
        onSuccess(response.data.room.code);
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al crear sala');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Crear Sala de Bingo</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Modo */}
          <div>
            <label className="block text-white/80 mb-2">Modo</label>
            <select
              value={config.mode}
              onChange={(e) => setConfig({ ...config, mode: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="75">75 números</option>
              <option value="90">90 números</option>
            </select>
          </div>

          {/* Patrón */}
          <div>
            <label className="block text-white/80 mb-2">Patrón de Victoria</label>
            <select
              value={config.pattern_type}
              onChange={(e) => setConfig({ ...config, pattern_type: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="line">Línea</option>
              <option value="corners">Esquinas</option>
              <option value="fullcard">Cartón Completo</option>
            </select>
          </div>

          {/* Moneda */}
          <div>
            <label className="block text-white/80 mb-2">Moneda</label>
            <select
              value={config.currency_type}
              onChange={(e) => setConfig({ ...config, currency_type: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="coins">Monedas</option>
              <option value="fires">Fuegos</option>
            </select>
          </div>

          {/* Costo por cartón */}
          <div>
            <label className="block text-white/80 mb-2">Costo por Cartón</label>
            <input
              type="number"
              value={config.card_cost}
              onChange={(e) => setConfig({ ...config, card_cost: parseInt(e.target.value) })}
              min="1"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            />
          </div>

          {/* Max jugadores */}
          <div>
            <label className="block text-white/80 mb-2">Máximo de Jugadores</label>
            <input
              type="number"
              value={config.max_players}
              onChange={(e) => setConfig({ ...config, max_players: parseInt(e.target.value) })}
              min="2"
              max="30"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            />
          </div>

          {/* Max cartones por jugador */}
          <div>
            <label className="block text-white/80 mb-2">Máximo Cartones por Jugador</label>
            <input
              type="number"
              value={config.max_cards_per_player}
              onChange={(e) => setConfig({ ...config, max_cards_per_player: parseInt(e.target.value) })}
              min="1"
              max="10"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
            />
          </div>

          {/* Pública */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_public"
              checked={config.is_public}
              onChange={(e) => setConfig({ ...config, is_public: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="is_public" className="text-white/80">Sala Pública</label>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg text-white rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Sala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
