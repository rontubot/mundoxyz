import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, MessageCircle, Save, Check, AlertCircle, ExternalLink } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import TelegramLinkModal from './TelegramLinkModal';
import PasswordRequiredModal from './PasswordRequiredModal';

const MyDataModal = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    display_name: '',
    nickname: '',
    email: '',
    bio: ''
  });
  const [loading, setLoading] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState(null);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [showTelegramLink, setShowTelegramLink] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingSecurityAnswer, setEditingSecurityAnswer] = useState(false);
  const [newSecurityAnswer, setNewSecurityAnswer] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  // Helper: Check if user has password
  const checkHasPassword = async () => {
    try {
      await axios.post(`/api/profile/${user.id}/check-password`, { password: 'dummy-check' });
      return true; // Tiene contraseña (aunque falló la verificación)
    } catch (err) {
      // Si devuelve requiresPasswordCreation (400), NO tiene contraseña
      if (err.response?.data?.requiresPasswordCreation) {
        return false;
      }
      // Si devuelve 401 (Unauthorized), SÍ tiene contraseña (pero es incorrecta)
      if (err.response?.status === 401) {
        return true;
      }
      // Cualquier otro error, asumir que tiene contraseña por seguridad
      return true;
    }
  };

  // Initialize form data with user data - SOLO cuando el modal se abre
  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        display_name: user.display_name || '',
        nickname: user.nickname || '',
        email: user.email || '',
        bio: user.bio || ''
      });
      setHasChanges(false);
    }
  }, [isOpen]); // ✅ Solo cuando isOpen cambia, NO cuando user cambia

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setHasChanges(true);

    // Check nickname availability in real-time
    if (name === 'nickname') {
      checkNicknameAvailability(value);
    }
  };

  const checkNicknameAvailability = async (nickname) => {
    if (!nickname || nickname === user?.nickname) {
      setNicknameStatus(null);
      return;
    }

    setCheckingNickname(true);
    try {
      const response = await axios.get(`/api/profile/check-nickname/${nickname}`);
      setNicknameStatus(response.data);
    } catch (error) {
      console.error('Error checking nickname:', error);
      setNicknameStatus(null);
    } finally {
      setCheckingNickname(false);
    }
  };

  const handleSave = async () => {
    // If email changed, require password (only if user has password)
    if (formData.email !== user?.email) {
      const hasPassword = await checkHasPassword();
      if (hasPassword) {
        setPendingAction('save');
        setShowPasswordModal(true);
        return;
      } else {
        // Usuario sin contraseña, sugerir establecer una
        toast.error('Por seguridad, establece una contraseña antes de cambiar tu email', {
          duration: 5000,
          icon: '🔒'
        });
        return;
      }
    }

    // Direct save if email didn't change
    await saveProfile();
  };

  const saveProfile = async () => {
    // Validate nickname if changed
    if (formData.nickname && formData.nickname !== user?.nickname) {
      if (nicknameStatus && !nicknameStatus.available) {
        toast.error(`Alias no disponible: ${nicknameStatus.reason}`);
        return;
      }
    }

    setLoading(true);
    try {
      await axios.put(`/api/profile/${user.id}/update-profile`, formData);
      toast.success('Perfil actualizado exitosamente');
      
      // Actualizar usuario y refrescar todas las queries
      await refreshUser();
      queryClient.invalidateQueries(['user-stats', user.id]);
      queryClient.invalidateQueries(['user-profile', user.id]);
      
      setHasChanges(false);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordConfirmed = () => {
    setShowPasswordModal(false);
    if (pendingAction === 'save') {
      saveProfile();
    } else if (pendingAction === 'unlink-telegram') {
      unlinkTelegram();
    }
  };

  const handleUnlinkTelegram = async () => {
    const hasPassword = await checkHasPassword();
    if (hasPassword) {
      setPendingAction('unlink-telegram');
      setShowPasswordModal(true);
    } else {
      // Usuario sin contraseña, sugerir establecer una
      toast.error('Por seguridad, establece una contraseña antes de desvincular Telegram', {
        duration: 5000,
        icon: '🔒'
      });
    }
  };

  const unlinkTelegram = async () => {
    try {
      await axios.post(`/api/profile/${user.id}/unlink-telegram`);
      toast.success('Telegram desvinculado');
      
      // Actualizar usuario y refrescar queries
      await refreshUser();
      queryClient.invalidateQueries(['user-stats', user.id]);
      queryClient.invalidateQueries(['user-profile', user.id]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al desvincular');
    }
  };

  const handleUpdateSecurityAnswer = async () => {
    // Validar
    if (!newSecurityAnswer || newSecurityAnswer.trim().length < 3) {
      toast.error('La respuesta debe tener al menos 3 caracteres');
      return;
    }
    
    if (!currentPassword) {
      toast.error('Debes ingresar tu contraseña actual');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/update-security-answer', {
        new_security_answer: newSecurityAnswer,
        current_password: currentPassword
      });
      
      toast.success('Respuesta de seguridad actualizada correctamente');
      
      // Limpiar campos
      setEditingSecurityAnswer(false);
      setNewSecurityAnswer('');
      setCurrentPassword('');
      
      // Actualizar usuario
      await refreshUser();
      queryClient.invalidateQueries(['user-stats', user.id]);
      
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al actualizar respuesta de seguridad');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('¿Deseas salir sin guardar los cambios?')) {
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg card-glass p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <User size={24} className="text-accent" />
                  Mis Datos
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-accent text-dark'
                      : 'bg-glass hover:bg-glass-hover'
                  }`}
                >
                  👤 Perfil
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === 'contact'
                      ? 'bg-accent text-dark'
                      : 'bg-glass hover:bg-glass-hover'
                  }`}
                >
                  📧 Contacto
                </button>
                <button
                  onClick={() => setActiveTab('telegram')}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === 'telegram'
                      ? 'bg-accent text-dark'
                      : 'bg-glass hover:bg-glass-hover'
                  }`}
                >
                  💬 Telegram
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === 'security'
                      ? 'bg-accent text-dark'
                      : 'bg-glass hover:bg-glass-hover'
                  }`}
                >
                  🔒 Seguridad
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                  <>
                    {/* Username (read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-text/80 mb-2">
                        Nombre de Usuario
                      </label>
                      <div className="input-glass bg-glass/50 flex items-center justify-between">
                        <span>@{user?.username}</span>
                        <span className="text-xs text-text/40">🔒 No editable</span>
                      </div>
                      <p className="text-xs text-text/60 mt-1">
                        Tu identificador único en MundoXYZ
                      </p>
                    </div>

                    {/* Display Name */}
                    <div>
                      <label className="block text-sm font-medium text-text/80 mb-2">
                        Nombre para Mostrar
                      </label>
                      <input
                        type="text"
                        name="display_name"
                        value={formData.display_name}
                        onChange={handleChange}
                        className="input-glass w-full"
                        placeholder="Ej: Juan Pérez"
                        maxLength={50}
                      />
                      <p className="text-xs text-text/60 mt-1">
                        Cómo te verán los demás usuarios
                      </p>
                    </div>

                    {/* Nickname/Alias */}
                    <div>
                      <label className="block text-sm font-medium text-text/80 mb-2">
                        Alias (opcional)
                      </label>
                      <input
                        type="text"
                        name="nickname"
                        value={formData.nickname}
                        onChange={handleChange}
                        maxLength={20}
                        className={`input-glass w-full ${
                          nicknameStatus?.available === false ? 'border-red-500' : ''
                        } ${nicknameStatus?.available === true ? 'border-green-500' : ''}`}
                        placeholder="Ej: El Rey del Bingo"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-text/60">
                          {formData.nickname.length}/20 caracteres
                        </span>
                        {checkingNickname && (
                          <span className="text-xs text-text/60">Verificando...</span>
                        )}
                        {nicknameStatus && formData.nickname !== user?.nickname && !checkingNickname && (
                          <span className={`text-xs ${
                            nicknameStatus.available ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {nicknameStatus.available ? '✓ Disponible' : `✗ ${nicknameStatus.reason}`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text/60 mt-1">
                        Apodo único (sin palabras ofensivas)
                      </p>
                    </div>

                    {/* Bio */}
                    <div>
                      <label className="block text-sm font-medium text-text/80 mb-2">
                        Biografía (opcional)
                      </label>
                      <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        maxLength={500}
                        rows={4}
                        className="input-glass w-full resize-none"
                        placeholder="Cuéntanos algo sobre ti..."
                      />
                      <span className="text-xs text-text/60">
                        {formData.bio.length}/500 caracteres
                      </span>
                    </div>
                  </>
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                  <>
                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-text/80 mb-2">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="input-glass w-full"
                        placeholder="ejemplo@correo.com"
                      />
                      {formData.email !== user?.email && (
                        <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                          <AlertCircle size={16} className="text-warning mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-warning">
                            Se requerirá tu contraseña para cambiar el email
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-glass">
                      <p className="text-sm text-text/80 mb-2">
                        <strong>Nota sobre verificación:</strong>
                      </p>
                      <p className="text-xs text-text/60">
                        Por el momento, solo necesitas que tu email coincida al momento del registro. 
                        La verificación por código estará disponible en una futura actualización.
                      </p>
                    </div>
                  </>
                )}

                {/* Telegram Tab */}
                {activeTab === 'telegram' && (
                  <>
                    {user?.tg_id ? (
                      // Already linked
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                          <div className="flex items-center gap-3 mb-3">
                            <Check size={20} className="text-success" />
                            <span className="font-semibold text-success">Telegram Vinculado</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <p><strong>ID:</strong> <code className="px-2 py-1 bg-glass rounded">{user.tg_id}</code></p>
                            <p className="text-xs text-text/60">
                              Tu cuenta de Telegram está conectada con MundoXYZ
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={handleUnlinkTelegram}
                          className="w-full px-4 py-3 bg-error/20 hover:bg-error/30 text-error rounded-lg transition-colors font-semibold border border-error/30"
                        >
                          Desvincular Telegram
                        </button>

                        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                          <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-warning mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-warning">
                              Se requerirá tu contraseña para desvincular tu cuenta de Telegram
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Not linked
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                          <h3 className="font-semibold mb-2">¿Por qué vincular Telegram?</h3>
                          <ul className="text-sm text-text/80 space-y-1 list-disc list-inside">
                            <li>Notificaciones instantáneas</li>
                            <li>Inicio de sesión rápido</li>
                            <li>Recuperación de cuenta</li>
                            <li>Acceso desde el bot</li>
                          </ul>
                        </div>

                        <button
                          onClick={() => setShowTelegramLink(true)}
                          className="w-full px-4 py-3 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                        >
                          <MessageCircle size={18} />
                          Vincular Telegram
                        </button>

                        <p className="text-xs text-center text-text/60">
                          Puedes vincular de forma automática con el bot o manualmente
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                  <>
                    <div className="p-4 rounded-lg bg-violet/10 border border-violet/30 mb-4">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        🔒 Respuesta de Seguridad
                      </h3>
                      <p className="text-sm text-text/80 mb-4">
                        Esta respuesta te permite recuperar tu clave si la olvidas. Manténla segura y memorable.
                      </p>
                      
                      {!editingSecurityAnswer ? (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-glass">
                            <p className="text-xs text-text/60 mb-1">Estado actual:</p>
                            <p className="font-medium">
                              {user?.security_answer ? '✅ Configurada' : '❌ No configurada'}
                            </p>
                          </div>
                          
                          <button
                            onClick={() => setEditingSecurityAnswer(true)}
                            className="w-full px-4 py-2 bg-violet hover:bg-violet/90 text-white rounded-lg transition-colors font-medium"
                          >
                            {user?.security_answer ? 'Cambiar Respuesta' : 'Configurar Respuesta'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-text/80 mb-2">
                              Nueva Respuesta de Seguridad
                            </label>
                            <input
                              type="text"
                              value={newSecurityAnswer}
                              onChange={(e) => setNewSecurityAnswer(e.target.value)}
                              placeholder="Ej: Nombre de tu primera mascota"
                              className="input-glass w-full"
                            />
                            <p className="text-xs text-text/60 mt-1">
                              Mínimo 3 caracteres, máximo 255
                            </p>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-text/80 mb-2">
                              Confirma con tu Clave Actual
                            </label>
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Tu contraseña actual"
                              className="input-glass w-full"
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingSecurityAnswer(false);
                                setNewSecurityAnswer('');
                                setCurrentPassword('');
                              }}
                              className="flex-1 px-4 py-2 bg-glass hover:bg-glass-hover rounded-lg transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleUpdateSecurityAnswer}
                              disabled={loading || !newSecurityAnswer || !currentPassword}
                              className="flex-1 px-4 py-2 bg-success hover:bg-success/90 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 rounded-lg bg-info/10 border border-info/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="text-info mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-info">
                          <p className="font-semibold mb-1">Consejos de seguridad:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Usa una respuesta que solo tú conozcas</li>
                            <li>Evita información pública (fecha de nacimiento, etc.)</li>
                            <li>No compartas tu respuesta con nadie</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              {(activeTab === 'profile' || activeTab === 'contact') && (
                <div className="flex gap-3 mt-6 pt-6 border-t border-glass">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 bg-glass hover:bg-glass-hover rounded-lg transition-colors"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading || !hasChanges || (nicknameStatus && !nicknameStatus.available)}
                    className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-dark rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telegram Link Modal */}
      <TelegramLinkModal
        isOpen={showTelegramLink}
        onClose={() => setShowTelegramLink(false)}
      />

      {/* Password Required Modal */}
      <PasswordRequiredModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordConfirmed}
        action={pendingAction === 'save' && formData.email !== user?.email ? 'cambiar tu email' : 'desvincular Telegram'}
      />
    </>
  );
};

export default MyDataModal;
