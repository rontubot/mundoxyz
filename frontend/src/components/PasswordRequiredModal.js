import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const PasswordRequiredModal = ({ isOpen, onClose, onSuccess, action = 'esta acción' }) => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!password) {
      setError('Ingresa tu contraseña');
      return;
    }

    if (!user || !user.id) {
      setError('Error: Usuario no identificado');
      console.error('User data missing:', user);
      return;
    }

    setLoading(true);
    try {
      console.log('Checking password for user:', user.id);
      const response = await axios.post(`/api/profile/${user.id}/check-password`, { password });
      
      if (response.data.valid) {
        toast.success('Contraseña verificada');
        onSuccess();
        handleClose();
      }
    } catch (err) {
      console.error('Password check error:', err.response?.data || err.message);
      if (err.response?.data?.requiresPasswordCreation) {
        setError('Debes establecer una contraseña primero');
        toast.error('Por seguridad, establece una contraseña desde "Cambiar Contraseña"');
      } else if (err.response?.status === 403) {
        setError('No autorizado para verificar esta contraseña');
        console.error('Authorization failed. User:', user.id, 'Response:', err.response.data);
      } else {
        const errorMsg = err.response?.data?.error || 'Contraseña incorrecta';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                  <Lock size={20} className="text-warning" />
                </div>
                <h2 className="text-xl font-bold">Confirmar Contraseña</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Message */}
            <div className="mb-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
                <AlertCircle size={20} className="text-warning mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  Por seguridad, necesitas confirmar tu contraseña para <strong>{action}</strong>.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text/80 mb-2">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`input-glass w-full ${error ? 'border-red-500' : ''}`}
                  placeholder="••••••••"
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-red-400 mt-1">{error}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 bg-glass hover:bg-glass-hover rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-dark rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? 'Verificando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PasswordRequiredModal;
