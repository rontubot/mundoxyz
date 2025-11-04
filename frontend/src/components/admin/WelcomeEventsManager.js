import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Gift, Plus, Play, Pause, TrendingUp, Users, Coins, Flame, Calendar, Settings, ChevronDown } from 'lucide-react';

const WelcomeEventsManager = () => {
  const [activeTab, setActiveTab] = useState('events');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const queryClient = useQueryClient();

  const [eventData, setEventData] = useState({
    name: '',
    message: '',
    coins_amount: 0,
    fires_amount: 0,
    event_type: 'manual',
    target_segment: { type: 'all' },
    max_claims: null,
    max_per_user: 1,
    cooldown_hours: null,
    require_claim: true,
    auto_send: false,
    expires_hours: 72,
    priority: 0
  });

  // Queries
  const { data: events, isLoading } = useQuery({
    queryKey: ['admin-welcome-events'],
    queryFn: async () => {
      const response = await axios.get('/api/admin/welcome/events?includeInactive=true');
      return response.data;
    }
  });

  const { data: analytics } = useQuery({
    queryKey: ['gift-analytics-dashboard'],
    queryFn: async () => {
      const response = await axios.get('/api/gifts/analytics/dashboard?days=30');
      return response.data;
    }
  });

  // Mutations
  const createEventMutation = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post('/api/admin/welcome/events', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('✅ Evento creado exitosamente');
      setShowCreateModal(false);
      setEventData({
        name: '',
        message: '',
        coins_amount: 0,
        fires_amount: 0,
        event_type: 'manual',
        target_segment: { type: 'all' },
        max_claims: null,
        max_per_user: 1,
        cooldown_hours: null,
        require_claim: true,
        auto_send: false,
        expires_hours: 72,
        priority: 0
      });
      queryClient.invalidateQueries(['admin-welcome-events']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al crear evento');
    }
  });

  const activateEventMutation = useMutation({
    mutationFn: async (eventId) => {
      const response = await axios.post(`/api/admin/welcome/events/${eventId}/activate`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('✅ Evento activado');
      queryClient.invalidateQueries(['admin-welcome-events']);
    },
    onError: () => {
      toast.error('❌ Error al activar evento');
    }
  });

  const deactivateEventMutation = useMutation({
    mutationFn: async (eventId) => {
      const response = await axios.post(`/api/admin/welcome/events/${eventId}/deactivate`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('⏸️ Evento desactivado');
      queryClient.invalidateQueries(['admin-welcome-events']);
    },
    onError: () => {
      toast.error('❌ Error al desactivar evento');
    }
  });

  const handleCreateEvent = (e) => {
    e.preventDefault();
    createEventMutation.mutate(eventData);
  };

  const getEventTypeLabel = (type) => {
    const types = {
      manual: 'Manual',
      first_login: 'Primer Ingreso',
      daily: 'Diario',
      weekly: 'Semanal',
      monthly: 'Mensual',
      comeback: 'Regreso'
    };
    return types[type] || type;
  };

  const getTargetSegmentLabel = (segment) => {
    if (!segment || !segment.type) return 'Todos';
    const types = {
      all: 'Todos los usuarios',
      first_time: 'Primera vez',
      inactive: `Inactivos (${segment.days || 7} días)`,
      low_balance: 'Saldo bajo',
      existing_users: 'Solo usuarios existentes'
    };
    return types[segment.type] || segment.type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header con tabs */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">🎁 Sistema de Fidelización</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Crear Evento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-text/10 mb-6">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'events'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text/60 hover:text-text'
          }`}
        >
          📋 Eventos
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text/60 hover:text-text'
          }`}
        >
          📊 Analíticas
        </button>
      </div>

      {/* Content */}
      {activeTab === 'events' && (
        <div>
          {/* Stats rápidas */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="card-glass">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text/60">Eventos Totales</div>
                    <div className="text-2xl font-bold text-accent">{analytics.total_events || 0}</div>
                  </div>
                  <Calendar size={32} className="text-accent/50" />
                </div>
              </div>
              <div className="card-glass">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text/60">Claims Totales</div>
                    <div className="text-2xl font-bold text-success">{analytics.total_claims || 0}</div>
                  </div>
                  <Users size={32} className="text-success/50" />
                </div>
              </div>
              <div className="card-glass">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text/60">Usuarios Retornaron</div>
                    <div className="text-2xl font-bold text-fire-orange">{analytics.users_returned || 0}</div>
                  </div>
                  <TrendingUp size={32} className="text-fire-orange/50" />
                </div>
              </div>
              <div className="card-glass">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text/60">Tasa de Retorno</div>
                    <div className="text-2xl font-bold text-violet">{analytics.return_rate || 0}%</div>
                  </div>
                  <Gift size={32} className="text-violet/50" />
                </div>
              </div>
            </div>
          )}

          {/* Lista de eventos */}
          <div className="space-y-3">
            {events && events.length > 0 ? (
              events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-glass hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg text-text">{event.name}</h3>
                        {event.is_active ? (
                          <span className="badge-coins text-xs flex items-center gap-1">
                            <Play size={12} /> Activo
                          </span>
                        ) : (
                          <span className="badge bg-gray-500/20 text-gray-400 text-xs flex items-center gap-1">
                            <Pause size={12} /> Inactivo
                          </span>
                        )}
                        <span className="badge bg-violet/20 text-violet text-xs">
                          {getEventTypeLabel(event.event_type)}
                        </span>
                      </div>

                      <p className="text-sm text-text/70 mb-3">{event.message}</p>

                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Coins size={16} className="text-accent" />
                          <span className="font-semibold text-accent">{event.coins_amount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flame size={16} className="text-fire-orange" />
                          <span className="font-semibold text-fire-orange">{event.fires_amount}</span>
                        </div>
                        <div className="text-text/60">
                          👥 {event.claimed_count || 0} {event.max_claims ? `/ ${event.max_claims}` : ''} claims
                        </div>
                        <div className="text-text/60">
                          🎯 {getTargetSegmentLabel(event.target_segment)}
                        </div>
                        {event.total_coins_claimed && (
                          <div className="text-success">
                            💰 {Number(event.total_coins_claimed).toLocaleString()} 🪙 distribuidos
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {event.is_active ? (
                        <button
                          onClick={() => deactivateEventMutation.mutate(event.id)}
                          className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded text-sm hover:bg-gray-500/30"
                          disabled={deactivateEventMutation.isLoading}
                        >
                          <Pause size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => activateEventMutation.mutate(event.id)}
                          className="px-3 py-1 bg-success/20 text-success rounded text-sm hover:bg-success/30"
                          disabled={activateEventMutation.isLoading}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowConfigModal(true);
                        }}
                        className="px-3 py-1 bg-accent/20 text-accent rounded text-sm hover:bg-accent/30"
                      >
                        <Settings size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="card-glass text-center py-12">
                <Gift size={48} className="mx-auto text-text/30 mb-4" />
                <p className="text-text/60 mb-4">No hay eventos creados aún</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary mx-auto"
                >
                  Crear Primer Evento
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Distribución total */}
            <div className="card-glass">
              <h3 className="font-bold text-lg mb-4">💰 Distribución Total (30 días)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-text/60">Coins Distribuidos</span>
                  <span className="font-bold text-accent text-xl">
                    🪙 {Number(analytics.total_coins_distributed || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text/60">Fires Distribuidos</span>
                  <span className="font-bold text-fire-orange text-xl">
                    🔥 {Number(analytics.total_fires_distributed || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-text/10">
                  <span className="text-text/60">Coins en Regalos</span>
                  <span className="font-bold text-accent">
                    🪙 {Number(analytics.total_coins_gifted || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text/60">Fires en Regalos</span>
                  <span className="font-bold text-fire-orange">
                    🔥 {Number(analytics.total_fires_gifted || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* ROI y Engagement */}
            <div className="card-glass">
              <h3 className="font-bold text-lg mb-4">📈 ROI y Engagement</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-text/60">Tasa de Retorno</span>
                    <span className="font-bold text-success">{analytics.return_rate || 0}%</span>
                  </div>
                  <div className="w-full bg-text/10 rounded-full h-2">
                    <div
                      className="bg-success rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(analytics.return_rate || 0, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text/60">Usuarios que Retornaron</span>
                  <span className="font-bold text-text">{analytics.users_returned || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text/60">Promedio Juegos Después</span>
                  <span className="font-bold text-violet">{analytics.avg_games_after || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-text/10">
                  <span className="text-text/60">Total Claims</span>
                  <span className="font-bold text-accent">{(analytics.total_claims || 0) + (analytics.total_gift_claims || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Evento */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card-glass w-full max-w-2xl my-8"
            >
              <h3 className="text-xl font-bold mb-4">✨ Crear Nuevo Evento</h3>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                {/* Información básica */}
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre del Evento *</label>
                  <input
                    type="text"
                    value={eventData.name}
                    onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                    className="input-glass w-full"
                    required
                    placeholder="Ej: Bono de Bienvenida"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Mensaje</label>
                  <textarea
                    value={eventData.message}
                    onChange={(e) => setEventData({ ...eventData, message: e.target.value })}
                    className="input-glass w-full"
                    rows="3"
                    placeholder="¡Bienvenido a MundoXYZ! Disfruta de tu regalo..."
                  />
                </div>

                {/* Montos */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">🪙 Coins</label>
                    <input
                      type="number"
                      value={eventData.coins_amount}
                      onChange={(e) => setEventData({ ...eventData, coins_amount: parseInt(e.target.value) || 0 })}
                      className="input-glass w-full"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">🔥 Fires</label>
                    <input
                      type="number"
                      value={eventData.fires_amount}
                      onChange={(e) => setEventData({ ...eventData, fires_amount: parseInt(e.target.value) || 0 })}
                      className="input-glass w-full"
                      min="0"
                    />
                  </div>
                </div>

                {/* Tipo y Segmento */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de Evento</label>
                    <select
                      value={eventData.event_type}
                      onChange={(e) => setEventData({ ...eventData, event_type: e.target.value })}
                      className="input-glass w-full"
                    >
                      <option value="manual">Manual</option>
                      <option value="first_login">Primer Ingreso</option>
                      <option value="daily">Diario</option>
                      <option value="weekly">Semanal</option>
                      <option value="comeback">Regreso</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Segmento</label>
                    <select
                      value={eventData.target_segment?.type || 'all'}
                      onChange={(e) => {
                        const newSegment = { ...eventData.target_segment, type: e.target.value };
                        // Si selecciona 'existing_users', agregar fecha actual automáticamente
                        if (e.target.value === 'existing_users') {
                          newSegment.registered_before = new Date().toISOString();
                        }
                        setEventData({ ...eventData, target_segment: newSegment });
                      }}
                      className="input-glass w-full"
                    >
                      <option value="all">Todos</option>
                      <option value="first_time">Primera Vez</option>
                      <option value="inactive">Inactivos</option>
                      <option value="low_balance">Saldo Bajo</option>
                      <option value="existing_users">Solo Usuarios Existentes</option>
                    </select>
                    {eventData.target_segment?.type === 'existing_users' && (
                      <p className="text-xs text-accent mt-1">
                        ℹ️ Este evento solo llegará a usuarios registrados ANTES de ahora
                      </p>
                    )}
                  </div>
                </div>

                {/* Límites */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Claims</label>
                    <input
                      type="number"
                      value={eventData.max_claims || ''}
                      onChange={(e) => setEventData({ ...eventData, max_claims: e.target.value ? parseInt(e.target.value) : null })}
                      className="input-glass w-full"
                      placeholder="Ilimitado"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max x Usuario</label>
                    <input
                      type="number"
                      value={eventData.max_per_user || ''}
                      onChange={(e) => setEventData({ ...eventData, max_per_user: e.target.value ? parseInt(e.target.value) : null })}
                      className="input-glass w-full"
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Expira (hrs)</label>
                    <input
                      type="number"
                      value={eventData.expires_hours}
                      onChange={(e) => setEventData({ ...eventData, expires_hours: parseInt(e.target.value) || 72 })}
                      className="input-glass w-full"
                      min="1"
                    />
                  </div>
                </div>

                {/* Opciones */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventData.require_claim}
                      onChange={(e) => setEventData({ ...eventData, require_claim: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Requiere aceptación</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventData.auto_send}
                      onChange={(e) => setEventData({ ...eventData, auto_send: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Envío automático</span>
                  </label>
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-600 text-text py-3 px-6 rounded-lg hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary"
                    disabled={createEventMutation.isLoading}
                  >
                    {createEventMutation.isLoading ? 'Creando...' : 'Crear Evento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WelcomeEventsManager;
