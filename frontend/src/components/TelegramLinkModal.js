import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Copy, Check, ExternalLink } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const TelegramLinkModal = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState('bot'); // 'bot' or 'manual'
  const [manualId, setManualId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [botUrl, setBotUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate bot link
  const generateBotLink = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`/api/profile/${user.id}/link-telegram`);
      setBotToken(response.data.linkToken);
      setBotUrl(response.data.telegramUrl);
      
      // Start polling to check if linked
      startPolling();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al generar enlace');
    } finally {
      setLoading(false);
    }
  };

  // Polling to check if user linked via bot
  const startPolling = () => {
    setChecking(true);
    const interval = setInterval(async () => {
      try {
        await refreshUser();
        // Check if tg_id was set
        const response = await axios.get(`/api/profile/${user.id}`);
        if (response.data.tg_id) {
          clearInterval(interval);
          setChecking(false);
          toast.success('¡Telegram vinculado exitosamente!');
          queryClient.invalidateQueries(['user-stats', user.id]);
          queryClient.invalidateQueries(['user-profile', user.id]);
          onClose();
        }
      } catch (error) {
        // Continue polling
      }
    }, 3000); // Check every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      setChecking(false);
    }, 300000);
  };

  // Link manually
  const handleManualLink = async () => {
    if (!manualId || isNaN(manualId)) {
      toast.error('ID de Telegram inválido');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`/api/profile/${user.id}/link-telegram-manual`, { tg_id: manualId });
      toast.success('Telegram vinculado exitosamente');
      await refreshUser();
      queryClient.invalidateQueries(['user-stats', user.id]);
      queryClient.invalidateQueries(['user-profile', user.id]);
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al vincular');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    if (botToken) {
      await navigator.clipboard.writeText(botToken);
      setCopied(true);
      toast.success('Token copiado');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setMethod('bot');
    setManualId('');
    setBotToken('');
    setBotUrl('');
    setChecking(false);
    onClose();
  };

  // Generate bot link when modal opens in bot mode
  useEffect(() => {
    if (isOpen && method === 'bot' && !botUrl) {
      generateBotLink();
    }
  }, [isOpen, method]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md card-glass p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">💬</span>
                Vincular Telegram
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Method selector */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMethod('bot')}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  method === 'bot'
                    ? 'bg-accent text-dark'
                    : 'bg-glass hover:bg-glass-hover'
                }`}
              >
                🤖 Con Bot
              </button>
              <button
                onClick={() => setMethod('manual')}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  method === 'manual'
                    ? 'bg-accent text-dark'
                    : 'bg-glass hover:bg-glass-hover'
                }`}
              >
                ✍️ Manual
              </button>
            </div>

            {/* Bot Method */}
            {method === 'bot' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-sm mb-3">
                        <strong>Paso 1:</strong> Click en el botón de abajo para abrir Telegram
                      </p>
                      <p className="text-sm mb-3">
                        <strong>Paso 2:</strong> Envía el comando <code className="px-2 py-1 bg-glass rounded">/start</code> al bot
                      </p>
                      <p className="text-sm">
                        <strong>Paso 3:</strong> Espera la confirmación (automático)
                      </p>
                    </div>

                    {botUrl && (
                      <a
                        href={botUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white rounded-lg transition-colors font-semibold"
                      >
                        <Send size={18} />
                        Abrir Bot de Telegram
                        <ExternalLink size={16} />
                      </a>
                    )}

                    {checking && (
                      <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-glass">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent"></div>
                        <span className="text-sm">Esperando vinculación...</span>
                      </div>
                    )}

                    {botToken && (
                      <div className="p-3 rounded-lg bg-glass">
                        <p className="text-xs text-text/60 mb-2">Token de sesión:</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono bg-dark/50 px-3 py-2 rounded overflow-x-auto">
                            {botToken.substring(0, 16)}...
                          </code>
                          <button
                            onClick={handleCopyToken}
                            className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
                          >
                            {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
                          </button>
                        </div>
                        <p className="text-xs text-text/40 mt-2">Expira en 15 minutos</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Manual Method */}
            {method === 'manual' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-sm mb-3">
                    <strong>Paso 1:</strong> Abre Telegram y busca <code className="px-2 py-1 bg-glass rounded">@userinfobot</code>
                  </p>
                  <p className="text-sm mb-3">
                    <strong>Paso 2:</strong> Envía <code className="px-2 py-1 bg-glass rounded">/start</code> al bot
                  </p>
                  <p className="text-sm">
                    <strong>Paso 3:</strong> Copia tu ID y pégalo abajo
                  </p>
                </div>

                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white rounded-lg transition-colors font-semibold"
                >
                  <ExternalLink size={18} />
                  Abrir @userinfobot
                </a>

                <div>
                  <label className="block text-sm font-medium text-text/80 mb-2">
                    Tu Telegram ID
                  </label>
                  <input
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    className="input-glass w-full"
                    placeholder="Ejemplo: 123456789"
                  />
                </div>

                <button
                  onClick={handleManualLink}
                  disabled={loading || !manualId}
                  className="w-full px-4 py-3 bg-accent hover:bg-accent/90 text-dark rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Vinculando...' : 'Vincular Telegram'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TelegramLinkModal;
