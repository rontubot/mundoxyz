import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const PasswordChangeModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [hasPassword, setHasPassword] = useState(null); // null = checking, true/false = result
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirm: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Check if user has password when modal opens
  useEffect(() => {
    if (isOpen && user) {
      checkIfHasPassword();
    }
  }, [isOpen, user]);

  const checkIfHasPassword = async () => {
    try {
      // Intentar verificar con password vacío para detectar si tiene password
      await axios.post(`/api/profile/${user.id}/check-password`, { password: 'dummy-check' });
      // Si llega aquí sin error, tiene password (aunque falló la verificación)
      setHasPassword(true);
    } catch (err) {
      // Si devuelve requiresPasswordCreation (400), NO tiene password
      if (err.response?.data?.requiresPasswordCreation) {
        setHasPassword(false);
      } 
      // Si devuelve 401 (Unauthorized), significa que SÍ tiene password (pero es incorrecta)
      else if (err.response?.status === 401) {
        setHasPassword(true);
      }
      // Cualquier otro error, asumir que tiene password por seguridad
      else {
        setHasPassword(true);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    // Solo validar contraseña actual si el usuario YA tiene contraseña
    if (hasPassword) {
      if (!formData.current_password) {
        newErrors.current_password = 'Contraseña actual requerida';
      }
    }

    if (!formData.new_password) {
      newErrors.new_password = 'Nueva contraseña requerida';
    } else if (formData.new_password.length < 6) {
      newErrors.new_password = 'Mínimo 6 caracteres';
    }

    if (!formData.new_password_confirm) {
      newErrors.new_password_confirm = 'Confirma la contraseña';
    } else if (formData.new_password !== formData.new_password_confirm) {
      newErrors.new_password_confirm = 'Las contraseñas no coinciden';
    }

    // Solo verificar que sea diferente si tiene password actual
    if (hasPassword && formData.current_password === formData.new_password) {
      newErrors.new_password = 'Debe ser diferente a la actual';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      await axios.put('/api/auth/change-password', formData);
      const message = hasPassword ? 'Contraseña actualizada correctamente' : '¡Contraseña establecida correctamente!';
      toast.success(message);
      setFormData({ current_password: '', new_password: '', new_password_confirm: '' });
      setHasPassword(true); // Ahora tiene contraseña
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ current_password: '', new_password: '', new_password_confirm: '' });
    setErrors({});
    setHasPassword(null);
    onClose();
  };

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
            className="w-full max-w-md card-glass p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet/20 flex items-center justify-center">
                  <Lock size={20} className="text-violet" />
                </div>
                <h2 className="text-xl font-bold">
                  {hasPassword === null ? 'Cargando...' : hasPassword ? 'Cambiar Contraseña' : 'Establecer Contraseña'}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Info message for first-time password setup */}
            {hasPassword === false && (
              <div className="mb-6">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <AlertCircle size={20} className="text-accent mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Primera vez</p>
                    <p className="text-text/80">
                      Establece una contraseña para proteger tu cuenta. Podrás cambiarla cuando quieras.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password - Solo mostrar si el usuario YA tiene contraseña */}
              {hasPassword && (
                <div>
                  <label className="block text-sm font-medium text-text/80 mb-2">
                    Contraseña Actual
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      name="current_password"
                      value={formData.current_password}
                      onChange={handleChange}
                      className={`input-glass w-full pr-10 ${errors.current_password ? 'border-red-500' : ''}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 hover:text-text"
                    >
                      {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.current_password && (
                    <p className="text-xs text-red-400 mt-1">{errors.current_password}</p>
                  )}
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-text/80 mb-2">
                  {hasPassword ? 'Nueva Contraseña' : 'Contraseña'}
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    name="new_password"
                    value={formData.new_password}
                    onChange={handleChange}
                    className={`input-glass w-full pr-10 ${errors.new_password ? 'border-red-500' : ''}`}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 hover:text-text"
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.new_password && (
                  <p className="text-xs text-red-400 mt-1">{errors.new_password}</p>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium text-text/80 mb-2">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    name="new_password_confirm"
                    value={formData.new_password_confirm}
                    onChange={handleChange}
                    className={`input-glass w-full pr-10 ${errors.new_password_confirm ? 'border-red-500' : ''}`}
                    placeholder="Repite la nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 hover:text-text"
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.new_password_confirm && (
                  <p className="text-xs text-red-400 mt-1">{errors.new_password_confirm}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 px-4 rounded-lg bg-glass hover:bg-glass-hover transition-colors"
                  disabled={loading || hasPassword === null}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || hasPassword === null}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    hasPassword ? 'Actualizando...' : 'Estableciendo...'
                  ) : (
                    <>
                      <Check size={18} />
                      {hasPassword ? 'Actualizar' : 'Establecer'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PasswordChangeModal;
