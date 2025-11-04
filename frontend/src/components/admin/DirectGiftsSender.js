import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Send, Search, Users, Coins, Flame } from 'lucide-react';

const DirectGiftsSender = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [giftData, setGiftData] = useState({
    target_type: 'single',
    target_segment: {},
    message: '',
    coins_amount: 0,
    fires_amount: 0,
    expires_hours: 48,
    auto_send: false
  });

  const searchUsers = async (term) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await axios.get(`/api/gifts/users/search?q=${term}`);
      setSearchResults(response.data.users);
    } catch (error) {
      toast.error('Error buscando usuarios');
    }
  };

  const sendGiftMutation = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post('/api/gifts/send', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('🎁 Regalo enviado exitosamente');
      setGiftData({
        target_type: 'single',
        target_segment: {},
        message: '',
        coins_amount: 0,
        fires_amount: 0,
        expires_hours: 48,
        auto_send: false
      });
      setSelectedUser(null);
      setSearchTerm('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al enviar regalo');
    }
  });

  const handleSendGift = (e) => {
    e.preventDefault();
    
    const payload = {
      ...giftData,
      target_user_id: giftData.target_type === 'single' ? selectedUser?.id : null
    };
    
    sendGiftMutation.mutate(payload);
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">📨 Envío Directo de Regalos</h2>

      <form onSubmit={handleSendGift} className="card-glass space-y-4">
        {/* Tipo de envío */}
        <div>
          <label className="block text-sm font-medium mb-2">Destinatario</label>
          <select
            value={giftData.target_type}
            onChange={(e) => {
              const newGiftData = { ...giftData, target_type: e.target.value };
              // Si selecciona 'existing_users', agregar fecha actual automáticamente
              if (e.target.value === 'existing_users') {
                newGiftData.target_segment = { registered_before: new Date().toISOString() };
              } else {
                newGiftData.target_segment = {};
              }
              setGiftData(newGiftData);
            }}
            className="input-glass w-full"
          >
            <option value="single">Usuario Específico</option>
            <option value="all">Todos los Usuarios</option>
            <option value="first_time">Primera Vez</option>
            <option value="inactive">Usuarios Inactivos (7 días)</option>
            <option value="low_balance">Saldo Bajo</option>
            <option value="existing_users">Solo Usuarios Existentes</option>
          </select>
          {giftData.target_type === 'existing_users' && (
            <p className="text-xs text-accent mt-1">
              ℹ️ Este regalo solo llegará a usuarios registrados ANTES de ahora
            </p>
          )}
        </div>

        {/* Búsqueda de usuario */}
        {giftData.target_type === 'single' && (
          <div>
            <label className="block text-sm font-medium mb-2">Buscar Usuario</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-text/40" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchUsers(e.target.value);
                }}
                className="input-glass w-full pl-10"
                placeholder="Buscar por username o email..."
              />
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 card-glass max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchTerm(user.username);
                      setSearchResults([]);
                    }}
                    className={`p-3 cursor-pointer hover:bg-accent/10 ${
                      selectedUser?.id === user.id ? 'bg-accent/20' : ''
                    }`}
                  >
                    <div className="font-medium">{user.username}</div>
                    <div className="text-sm text-text/60">{user.email}</div>
                    <div className="text-xs text-text/40 mt-1">
                      🪙 {Number(user.coins_balance).toLocaleString()} | 
                      🔥 {Number(user.fires_balance).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="mt-2 p-3 card-glass bg-success/10 border border-success/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-success">✓ {selectedUser.username}</div>
                    <div className="text-sm text-text/60">{selectedUser.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchTerm('');
                    }}
                    className="text-error hover:text-error/70"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mensaje */}
        <div>
          <label className="block text-sm font-medium mb-2">Mensaje *</label>
          <textarea
            value={giftData.message}
            onChange={(e) => setGiftData({ ...giftData, message: e.target.value })}
            className="input-glass w-full"
            rows="3"
            required
            placeholder="¡Gracias por ser parte de MundoXYZ! Este es un regalo especial para ti..."
          />
        </div>

        {/* Montos */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              <Coins size={16} className="inline mr-1" /> Coins
            </label>
            <input
              type="number"
              value={giftData.coins_amount}
              onChange={(e) => setGiftData({ ...giftData, coins_amount: parseInt(e.target.value) || 0 })}
              className="input-glass w-full"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              <Flame size={16} className="inline mr-1" /> Fires
            </label>
            <input
              type="number"
              value={giftData.fires_amount}
              onChange={(e) => setGiftData({ ...giftData, fires_amount: parseInt(e.target.value) || 0 })}
              className="input-glass w-full"
              min="0"
            />
          </div>
        </div>

        {/* Opciones */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Expira en (horas)</label>
            <input
              type="number"
              value={giftData.expires_hours}
              onChange={(e) => setGiftData({ ...giftData, expires_hours: parseInt(e.target.value) || 48 })}
              className="input-glass w-full"
              min="1"
            />
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={giftData.auto_send}
                onChange={(e) => setGiftData({ ...giftData, auto_send: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Acreditar automáticamente</span>
            </label>
          </div>
        </div>

        {/* Botón enviar */}
        <button
          type="submit"
          className="w-full btn-primary flex items-center justify-center gap-2"
          disabled={sendGiftMutation.isLoading || (giftData.target_type === 'single' && !selectedUser)}
        >
          <Send size={18} />
          {sendGiftMutation.isLoading ? 'Enviando...' : 'Enviar Regalo'}
        </button>
      </form>
    </div>
  );
};

export default DirectGiftsSender;
