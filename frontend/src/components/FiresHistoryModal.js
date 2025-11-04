import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Send, Download, ShoppingBag, Gift, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const FiresHistoryModal = ({ isOpen, onClose, onOpenSend, onOpenBuy, onOpenReceive }) => {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Usar React Query para manejar transacciones con refetch automático
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['wallet-transactions', user?.id, page],
    queryFn: async () => {
      if (!user?.id) return { transactions: [], total: 0 };
      const response = await axios.get(`/api/profile/${user.id}/transactions`, {
        params: {
          currency: 'fires',
          limit: pageSize,
          offset: page * pageSize
        }
      });
      return response.data;
    },
    enabled: isOpen && !!user?.id,
    refetchInterval: 5000, // Refetch cada 5 segundos cuando el modal está abierto
    refetchIntervalInBackground: false
  });

  const transactions = data?.transactions || [];
  const total = data?.total || 0;

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'transfer_in':
        return <ArrowDown size={16} className="text-green-400" />;
      case 'transfer_out':
        return <ArrowUp size={16} className="text-red-400" />;
      case 'fire_purchase':
        return <ShoppingBag size={16} />;
      case 'welcome_bonus':
      case 'game_reward':
      case 'tictactoe_win':
      case 'tictactoe_draw':
        return <Gift size={16} />;
      case 'commission':
        return <ArrowDown size={16} className="text-yellow-400" />;
      case 'game_bet':
      case 'tictactoe_bet':
        return <Clock size={16} className="text-orange-400" />;
      case 'tictactoe_refund':
        return <RefreshCw size={16} className="text-blue-400" />;
      default:
        return <Clock size={16} />;
    }
  };

  const getTransactionLabel = (type) => {
    const labels = {
      transfer_in: 'Fuegos Recibidos',
      transfer_out: 'Fuegos Enviados',
      fire_purchase: 'Compra de Fuegos',
      welcome_bonus: 'Bono de Bienvenida',
      game_reward: 'Premio de Juego',
      commission: 'Comisión',
      admin_grant: 'Regalo Admin',
      game_bet: 'Apuesta de Juego',
      tictactoe_bet: 'Apuesta TicTacToe',
      tictactoe_win: 'Victoria TicTacToe',
      tictactoe_draw: 'Empate TicTacToe',
      tictactoe_refund: 'Devolución TicTacToe'
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTransactionColor = (amount) => {
    return parseFloat(amount) >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-2xl card-glass p-6 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-fire-orange/20 flex items-center justify-center">
                  <Clock size={20} className="text-fire-orange" />
                </div>
                <h2 className="text-xl font-bold">Historial de Fuegos</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => {
                  onClose();
                  onOpenSend();
                }}
                className="py-3 px-4 bg-gradient-to-r from-fire-orange/20 to-yellow-400/20 hover:from-fire-orange/30 hover:to-yellow-400/30 rounded-lg transition-all duration-200 border border-fire-orange/30"
              >
                <Send size={18} className="mx-auto mb-1 text-fire-orange" />
                <span className="text-sm font-medium">Enviar</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenBuy();
                }}
                className="py-3 px-4 bg-gradient-to-r from-accent/20 to-primary/20 hover:from-accent/30 hover:to-primary/30 rounded-lg transition-all duration-200 border border-accent/30"
              >
                <ShoppingBag size={18} className="mx-auto mb-1 text-accent" />
                <span className="text-sm font-medium">COMPRAR</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenReceive();
                }}
                className="py-3 px-4 bg-gradient-to-r from-violet/20 to-purple-400/20 hover:from-violet/30 hover:to-purple-400/30 rounded-lg transition-all duration-200 border border-violet/30"
              >
                <Download size={18} className="mx-auto mb-1 text-violet" />
                <span className="text-sm font-medium">Recibir</span>
              </button>
            </div>

            {/* Transactions List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <Clock size={48} className="mx-auto text-text/30 mb-3" />
                  <p className="text-text/60">No hay transacciones de fuegos</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-4 hover:bg-glass-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        parseFloat(tx.amount) >= 0 ? 'bg-green-400/20' : 'bg-red-400/20'
                      }`}>
                        {getTransactionIcon(tx.type)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{getTransactionLabel(tx.type)}</span>
                          <span className={`font-bold ${getTransactionColor(tx.amount)}`}>
                            {parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(2)} 🔥
                          </span>
                        </div>
                        {tx.description && (
                          <p className="text-xs text-text/60 truncate">{tx.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-text/40">
                            {formatDate(tx.created_at)}
                          </span>
                          <span className="text-xs text-text/40">
                            Balance: {parseFloat(tx.balance_after).toFixed(2)} 🔥
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-glass">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 hover:bg-glass-hover rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                </button>

                <span className="text-sm text-text/70">
                  Página {page + 1} de {totalPages} ({total} transacciones)
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 hover:bg-glass-hover rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FiresHistoryModal;
