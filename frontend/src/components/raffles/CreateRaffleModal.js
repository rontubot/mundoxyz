/**
 * CreateRaffleModal.js - Modal para crear nuevas rifas
 * Configuración completa: modo, tipo, empresa, etc.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaTimes, FaFire, FaGift, FaBuilding, FaUpload,
  FaPalette, FaInfoCircle, FaCheck, FaStar,
  FaDollarSign, FaUsers, FaClock, FaTrophy,
  FaShieldAlt, FaFileContract, FaTags
} from 'react-icons/fa';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const CreateRaffleModal = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    // Información básica
    name: '',
    description: '',
    mode: 'fire',
    type: 'public',
    cost_per_number: 10,
    numbers_range: 100,
    
    // Configuración
    visibility: 'public',
    close_type: 'auto_full',
    scheduled_close_at: '',
    terms_conditions: '',
    
    // Modo empresa
    is_company_mode: false,
    company_config: {
      company_name: '',
      company_rif: '',
      primary_color: '#FF6B6B',
      secondary_color: '#4ECDC4',
      logo_url: ''
    },
    
    // Premio
    prize_meta: {
      description: '',
      estimated_value: '',
      delivery_info: '',
      prize_image_url: ''
    }
  });

  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  // Generar código numérico de 6 dígitos para preview
  useEffect(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
  }, []);

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    // Validación básica
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (formData.name.length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    } else if (formData.name.length > 100) {
      newErrors.name = 'El nombre no puede exceder 100 caracteres';
    }

    if (!formData.mode) {
      newErrors.mode = 'Selecciona un modo de juego';
    }

    if (!formData.cost_per_number || formData.cost_per_number <= 0) {
      newErrors.cost_per_number = 'El costo debe ser mayor a 0';
    }

    if (formData.cost_per_number > 100000) {
      newErrors.cost_per_number = 'El costo no puede exceder 100,000';
    }

    // Validación modo empresa
    if (formData.is_company_mode) {
      if (!formData.company_config.company_name.trim()) {
        newErrors.company_name = 'El nombre de la empresa es requerido';
      }

      if (!formData.company_config.company_rif.trim()) {
        newErrors.company_rif = 'El RIF de la empresa es requerido';
      } else if (!/^[JVG]-\d{8}-\d$/.test(formData.company_config.company_rif)) {
        newErrors.company_rif = 'Formato de RIF inválido (Ej: J-12345678-9)';
      }
    }

    // Validación modo premio
    if (formData.mode === 'prize') {
      if (!formData.prize_meta.description.trim()) {
        newErrors.prize_description = 'La descripción del premio es requerida';
      }

      if (formData.scheduled_close_at && new Date(formData.scheduled_close_at) <= new Date()) {
        newErrors.scheduled_close_at = 'La fecha debe ser futura';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Mutación para crear rifa
  const createRaffleMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/raffles/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear rifa');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success('¡Rifa creada exitosamente!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al crear la rifa');
    }
  });

  // Upload de logo
  const uploadLogo = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      setIsUploading(true);
      const response = await fetch('/api/raffles/upload-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error al subir logo');
      }

      const result = await response.json();
      setFormData(prev => ({
        ...prev,
        company_config: {
          ...prev.company_config,
          logo_url: result.data.logo_url
        }
      }));

      toast.success('Logo subido exitosamente');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Upload de foto del premio
  const uploadPrizeImage = async (file) => {
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('prize_image', file);

    try {
      setIsUploading(true);
      const response = await fetch('/api/raffles/upload-prize-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataUpload
      });

      if (!response.ok) {
        throw new Error('Error al subir imagen del premio');
      }

      const result = await response.json();
      setFormData(prev => ({
        ...prev,
        prize_meta: {
          ...prev.prize_meta,
          prize_image_url: result.data.image_url
        }
      }));

      toast.success('Imagen del premio subida exitosamente');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Submit del formulario
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Corrige los errores en el formulario');
      return;
    }

    const submitData = {
      ...formData,
      cost_per_number: parseFloat(formData.cost_per_number),
      scheduled_close_at: formData.scheduled_close_at || null
    };

    createRaffleMutation.mutate(submitData);
  };

  // Componente de tabs - Responsive
  const TabButton = ({ id, label, icon, completed }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-1 md:gap-2 px-3 md:px-6 py-2 md:py-3 rounded-xl text-sm md:text-base font-semibold transition-all duration-300 whitespace-nowrap ${
        activeTab === id
          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {completed && <FaCheck className="text-green-400 text-sm" />}
    </button>
  );

  // Preview de configuración
  const ConfigSummary = () => {
    const isCompleted = {
      basic: formData.name && formData.mode && formData.cost_per_number,
      config: formData.visibility && formData.close_type,
      company: !formData.is_company_mode || (formData.company_config.company_name && formData.company_config.company_rif),
      prize: formData.mode !== 'prize' || (formData.prize_meta.description && formData.terms_conditions)
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
          <span className="text-white font-semibold flex items-center gap-2">
            <FaInfoCircle />
            Configuración de Rifa
          </span>
          <span className="text-white/60 text-sm">Código: {generatedCode}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-xl">
            <h4 className="text-white font-semibold mb-2">Información Básica</h4>
            <ul className="space-y-1 text-sm text-white/70">
              <li>• Nombre: {formData.name || 'Sin definir'}</li>
              <li>• Modo: {formData.mode === 'fire' ? '🔥 Fuego' : '🎁 Premio'}</li>
              <li>• Costo: {formData.cost_per_number} {formData.mode === 'fire' ? 'fuegos' : 'fuegos'}</li>
              <li>• Números: 0-{formData.numbers_range - 1}</li>
            </ul>
            {isCompleted.basic && <FaCheck className="text-green-400 mt-2" />}
          </div>

          <div className="p-4 bg-white/5 rounded-xl">
            <h4 className="text-white font-semibold mb-2">Configuración</h4>
            <ul className="space-y-1 text-sm text-white/70">
              <li>• Visibilidad: {formData.visibility === 'public' ? 'Pública' : 'Privada'}</li>
              <li>• Cierre: {formData.close_type === 'auto_full' ? 'Automático' : 'Manual'}</li>
              <li>• Premio estimado: {(formData.numbers_range * formData.cost_per_number * 0.7).toFixed(2)} fuegos</li>
            </ul>
            {isCompleted.config && <FaCheck className="text-green-400 mt-2" />}
          </div>

          {formData.is_company_mode && (
            <div className="p-4 bg-white/5 rounded-xl border border-purple-500/30">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <FaBuilding />
                Modo Empresa
              </h4>
              <ul className="space-y-1 text-sm text-white/70">
                <li>• Empresa: {formData.company_config.company_name}</li>
                <li>• RIF: {formData.company_config.company_rif}</li>
                <li>• Costo adicional: 3000 fuegos</li>
              </ul>
              {isCompleted.company && <FaCheck className="text-green-400 mt-2" />}
            </div>
          )}

          {formData.mode === 'prize' && (
            <div className="p-4 bg-white/5 rounded-xl border border-green-500/30">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <FaGift />
                Modo Premio
              </h4>
              <ul className="space-y-1 text-sm text-white/70">
                <li>• Premio: {formData.prize_meta.description || 'Sin definir'}</li>
                <li>• Valor: {formData.prize_meta.estimated_value || 'No especificado'}</li>
                <li>• Aprobación: Manual por host</li>
              </ul>
              {isCompleted.prize && <FaCheck className="text-green-400 mt-2" />}
            </div>
          )}
        </div>

        <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-2">
            <FaShieldAlt className="text-yellow-400" />
            <span className="text-white font-semibold">Resumen de Costos</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-white/80">
              <span>Costo de creación (1 número):</span>
              <span>{formData.cost_per_number || 0} fuegos</span>
            </div>
            {formData.is_company_mode && (
              <div className="flex justify-between text-white/80">
                <span>Modo Empresa:</span>
                <span>+3000 fuegos</span>
              </div>
            )}
            <div className="flex justify-between text-white font-semibold pt-2 border-t border-white/20">
              <span>Total necesario:</span>
              <span>{(parseFloat(formData.cost_per_number) || 0) + (formData.is_company_mode ? 3000 : 0)} fuegos</span>
            </div>
            <div className="text-xs text-white/60 pt-2 border-t border-white/20">
              💡 El host debe pagar {formData.cost_per_number} fuegos como primer número
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 rounded-2xl md:rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/20">
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
              <FaTrophy className="text-yellow-400" />
              Crear Nueva Rifa
            </h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <FaTimes size={24} />
            </button>
          </div>

          {/* Tabs - Responsive */}
          <div className="flex items-center overflow-x-auto space-x-2 p-4 md:p-6 border-b border-white/20 scrollbar-hide">
            <TabButton
              id="basic"
              label="Información Básica"
              icon={<FaInfoCircle />}
              completed={formData.name && formData.mode}
            />
            <TabButton
              id="config"
              label="Configuración"
              icon={<FaClock />}
              completed={formData.visibility}
            />
            <TabButton
              id="company"
              label="Modo Empresa"
              icon={<FaBuilding />}
              completed={!formData.is_company_mode || formData.company_config.company_name}
            />
            <TabButton
              id="prize"
              label="Modo Premio"
              icon={<FaGift />}
              completed={formData.mode !== 'prize' || formData.prize_meta.description}
            />
            <TabButton
              id="summary"
              label="Resumen"
              icon={<FaCheck />}
              completed={false}
            />
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 overflow-y-auto max-h-[60vh]">
            <form onSubmit={handleSubmit}>
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Nombre de la Rifa <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Gran Sorteo de Navidad"
                      className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 ${
                        errors.name ? 'border-red-400' : 'border-white/20'
                      }`}
                      maxLength={100}
                    />
                    {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe tu rifa y los premios..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                      maxLength={500}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Modo de Juego <span className="text-red-400">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
                          <input
                            type="radio"
                            name="mode"
                            value="fire"
                            checked={formData.mode === 'fire'}
                            onChange={(e) => setFormData(prev => ({ ...prev, mode: e.target.value }))}
                            className="mr-3"
                          />
                          <div className="flex items-center gap-3">
                            <FaFire className="text-orange-400 text-xl" />
                            <div>
                              <div className="text-white font-semibold">Modo Fuego</div>
                              <div className="text-white/60 text-sm">Compras automáticas con balance</div>
                            </div>
                          </div>
                        </label>
                        
                        <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
                          <input
                            type="radio"
                            name="mode"
                            value="prize"
                            checked={formData.mode === 'prize'}
                            onChange={(e) => setFormData(prev => ({ ...prev, mode: e.target.value }))}
                            className="mr-3"
                          />
                          <div className="flex items-center gap-3">
                            <FaGift className="text-green-400 text-xl" />
                            <div>
                              <div className="text-white font-semibold">Modo Premio</div>
                              <div className="text-white/60 text-sm">Aprobación manual del host</div>
                            </div>
                          </div>
                        </label>
                      </div>
                      {errors.mode && <p className="text-red-400 text-sm mt-1">{errors.mode}</p>}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-white font-semibold mb-2">
                          Costo por Número (fuegos) <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          value={formData.cost_per_number}
                          onChange={(e) => setFormData(prev => ({ ...prev, cost_per_number: e.target.value }))}
                          placeholder="10"
                          min="1"
                          max="100000"
                          step="0.01"
                          className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 ${
                            errors.cost_per_number ? 'border-red-400' : 'border-white/20'
                          }`}
                        />
                        {errors.cost_per_number && <p className="text-red-400 text-sm mt-1">{errors.cost_per_number}</p>}
                      </div>

                      <div>
                        <label className="block text-white font-semibold mb-2">
                          Rango de Números
                        </label>
                        <select
                          value={formData.numbers_range}
                          onChange={(e) => setFormData(prev => ({ ...prev, numbers_range: parseInt(e.target.value) }))}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                        >
                          <option value="100">00-99 (100 números)</option>
                          <option value="1000">000-999 (1000 números)</option>
                          <option value="10000">0000-9999 (10000 números)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'config' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Visibilidad
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
                          <input
                            type="radio"
                            name="visibility"
                            value="public"
                            checked={formData.visibility === 'public'}
                            onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
                            className="mr-3"
                          />
                          <div>
                            <div className="text-white font-semibold">Pública</div>
                            <div className="text-white/60 text-sm">Visible para todos los usuarios</div>
                          </div>
                        </label>
                        
                        <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
                          <input
                            type="radio"
                            name="visibility"
                            value="private"
                            checked={formData.visibility === 'private'}
                            onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
                            className="mr-3"
                          />
                          <div>
                            <div className="text-white font-semibold">Privada</div>
                            <div className="text-white/60 text-sm">Solo con código de invitación</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Tipo de Cierre
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
                          <input
                            type="radio"
                            name="close_type"
                            value="auto_full"
                            checked={formData.close_type === 'auto_full'}
                            onChange={(e) => setFormData(prev => ({ ...prev, close_type: e.target.value }))}
                            className="mr-3"
                          />
                          <div>
                            <div className="text-white font-semibold">Automático</div>
                            <div className="text-white/60 text-sm">Al vender todos los números</div>
                          </div>
                        </label>
                        
                        <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
                          <input
                            type="radio"
                            name="close_type"
                            value="manual"
                            checked={formData.close_type === 'manual'}
                            onChange={(e) => setFormData(prev => ({ ...prev, close_type: e.target.value }))}
                            className="mr-3"
                          />
                          <div>
                            <div className="text-white font-semibold">Manual</div>
                            <div className="text-white/60 text-sm">El host decide cuándo cerrar</div>
                          </div>
                        </label>
                        
                        <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
                          <input
                            type="radio"
                            name="close_type"
                            value="scheduled"
                            checked={formData.close_type === 'scheduled'}
                            onChange={(e) => setFormData(prev => ({ ...prev, close_type: e.target.value }))}
                            className="mr-3"
                          />
                          <div>
                            <div className="text-white font-semibold">Programado</div>
                            <div className="text-white/60 text-sm">Fecha y hora específicas</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {formData.close_type === 'scheduled' && (
                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Fecha y Hora de Cierre
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduled_close_at}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduled_close_at: e.target.value }))}
                        min={new Date().toISOString().slice(0, 16)}
                        className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 ${
                          errors.scheduled_close_at ? 'border-red-400' : 'border-white/20'
                        }`}
                      />
                      {errors.scheduled_close_at && <p className="text-red-400 text-sm mt-1">{errors.scheduled_close_at}</p>}
                    </div>
                  )}

                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Términos y Condiciones
                    </label>
                    <textarea
                      value={formData.terms_conditions}
                      onChange={(e) => setFormData(prev => ({ ...prev, terms_conditions: e.target.value }))}
                      placeholder="Especifica los términos, condiciones y cualquier restricción aplicable..."
                      rows={4}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                      maxLength={2000}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'company' && (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-500/20 rounded-xl border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FaInfoCircle className="text-blue-400" />
                      <span className="text-white font-semibold">Modo Empresa</span>
                    </div>
                    <p className="text-white/80 text-sm">
                      Activa el modo empresa para darle a tu rifa un toque profesional con branding personalizado. 
                      Costo adicional: 3000 fuegos.
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center p-4 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.is_company_mode}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_company_mode: e.target.checked }))}
                        className="mr-3 w-5 h-5"
                      />
                      <div className="flex items-center gap-3">
                        <FaBuilding className="text-purple-400 text-xl" />
                        <div>
                          <div className="text-white font-semibold">Activar Modo Empresa</div>
                          <div className="text-white/60 text-sm">Branding personalizado +3000 fuegos</div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {formData.is_company_mode && (
                    <div className="space-y-4 p-6 bg-white/5 rounded-xl border border-white/10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-white font-semibold mb-2">
                            Nombre de la Empresa <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.company_config.company_name}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              company_config: { ...prev.company_config, company_name: e.target.value }
                            }))}
                            placeholder="Mi Empresa C.A."
                            className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 ${
                              errors.company_name ? 'border-red-400' : 'border-white/20'
                            }`}
                            maxLength={100}
                          />
                          {errors.company_name && <p className="text-red-400 text-sm mt-1">{errors.company_name}</p>}
                        </div>

                        <div>
                          <label className="block text-white font-semibold mb-2">
                            RIF <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.company_config.company_rif}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              company_config: { ...prev.company_config, company_rif: e.target.value.toUpperCase() }
                            }))}
                            placeholder="J-12345678-9"
                            className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 ${
                              errors.company_rif ? 'border-red-400' : 'border-white/20'
                            }`}
                          />
                          {errors.company_rif && <p className="text-red-400 text-sm mt-1">{errors.company_rif}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-white font-semibold mb-2">
                            Color Primario
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={formData.company_config.primary_color}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                company_config: { ...prev.company_config, primary_color: e.target.value }
                              }))}
                              className="w-16 h-10 rounded border border-white/20"
                            />
                            <input
                              type="text"
                              value={formData.company_config.primary_color}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                company_config: { ...prev.company_config, primary_color: e.target.value }
                              }))}
                              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-white font-semibold mb-2">
                            Color Secundario
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={formData.company_config.secondary_color}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                company_config: { ...prev.company_config, secondary_color: e.target.value }
                              }))}
                              className="w-16 h-10 rounded border border-white/20"
                            />
                            <input
                              type="text"
                              value={formData.company_config.secondary_color}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                company_config: { ...prev.company_config, secondary_color: e.target.value }
                              }))}
                              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-white font-semibold mb-2">
                          Logo de la Empresa
                        </label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl cursor-pointer transition-colors">
                            <FaUpload />
                            <span className="text-white">Subir Logo</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => uploadLogo(e.target.files[0])}
                              className="hidden"
                              disabled={isUploading}
                            />
                          </label>
                          
                          {formData.company_config.logo_url && (
                            <div className="flex items-center gap-3">
                              <img 
                                src={formData.company_config.logo_url} 
                                alt="Logo preview"
                                className="w-12 h-12 rounded-lg object-cover border border-white/20"
                              />
                              <span className="text-green-400 text-sm">Logo subido</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'prize' && formData.mode === 'prize' && (
                <div className="space-y-6">
                  <div className="p-4 bg-green-500/20 rounded-xl border border-green-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FaGift className="text-green-400" />
                      <span className="text-white font-semibold">Modo Premio</span>
                    </div>
                    <p className="text-white/80 text-sm">
                      En modo premio, las compras requieren aprobación manual del host. 
                      Especifica claramente qué se está rifando.
                    </p>
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Descripción del Premio <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.prize_meta.description}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        prize_meta: { ...prev.prize_meta, description: e.target.value }
                      }))}
                      placeholder="Describe detalladamente el premio que se está rifando..."
                      rows={3}
                      className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 ${
                        errors.prize_description ? 'border-red-400' : 'border-white/20'
                      }`}
                      maxLength={500}
                    />
                    {errors.prize_description && <p className="text-red-400 text-sm mt-1">{errors.prize_description}</p>}
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Foto del Premio <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl cursor-pointer transition-colors">
                        <FaUpload />
                        <span className="text-white">Subir Foto del Premio</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => uploadPrizeImage(e.target.files[0])}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                      
                      {formData.prize_meta.prize_image_url && (
                        <div className="flex items-center gap-3">
                          <img 
                            src={formData.prize_meta.prize_image_url} 
                            alt="Premio preview"
                            className="w-16 h-16 rounded-lg object-cover border border-white/20"
                          />
                          <span className="text-green-400 text-sm">✓ Foto subida</span>
                        </div>
                      )}
                    </div>
                    <p className="text-white/60 text-xs mt-2">
                      Los usuarios podrán ver esta foto en el botón "Premio" dentro del tablero de rifa
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Valor Estimado
                      </label>
                      <input
                        type="text"
                        value={formData.prize_meta.estimated_value}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          prize_meta: { ...prev.prize_meta, estimated_value: e.target.value }
                        }))}
                        placeholder="Ej: $500, Smartphone, etc."
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Información de Entrega
                      </label>
                      <input
                        type="text"
                        value={formData.prize_meta.delivery_info}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          prize_meta: { ...prev.prize_meta, delivery_info: e.target.value }
                        }))}
                        placeholder="Ej: Envío nacional, Retiro local, etc."
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                        maxLength={100}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'prize' && formData.mode !== 'prize' && (
                <div className="text-center py-8">
                  <FaGift className="text-6xl text-white/20 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">
                    Modo premio no disponible
                  </h3>
                  <p className="text-white/60">
                    Este modo solo está disponible cuando seleccionas "Modo Premio" en la configuración básica.
                  </p>
                </div>
              )}

              {activeTab === 'summary' && <ConfigSummary />}
            </form>
          </div>

          {/* Footer */}
          <div className="p-4 md:p-6 border-t border-white/20">
            {activeTab === 'summary' ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={createRaffleMutation.isLoading}
                  className="w-full px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {createRaffleMutation.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <FaTrophy />
                      Crear Rifa
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('prize')}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  Anterior
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const tabs = ['basic', 'config', 'company', 'prize', 'summary'];
                    const currentIndex = tabs.indexOf(activeTab);
                    if (currentIndex > 0) {
                      setActiveTab(tabs[currentIndex - 1]);
                    }
                  }}
                  disabled={activeTab === 'basic'}
                  className="px-4 md:px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors text-sm md:text-base"
                >
                  Anterior
                </button>
                
                <button
                  onClick={() => {
                    const tabs = ['basic', 'config', 'company', 'prize', 'summary'];
                    const currentIndex = tabs.indexOf(activeTab);
                    if (currentIndex < tabs.length - 1) {
                      setActiveTab(tabs[currentIndex + 1]);
                    }
                  }}
                  disabled={activeTab === 'summary'}
                  className="px-4 md:px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors text-sm md:text-base"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateRaffleModal;
