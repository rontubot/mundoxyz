import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

const ReceiveFiresModal = ({ isOpen, onClose, walletId }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletId);
      setCopied(true);
      toast.success('Dirección copiada al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Error al copiar');
    }
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
                <div className="w-10 h-10 rounded-full bg-fire-orange/20 flex items-center justify-center">
                  <Wallet size={20} className="text-fire-orange" />
                </div>
                <h2 className="text-xl font-bold">Recibir Fuegos</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              <p className="text-text/70 text-sm">
                Comparte tu dirección de billetera para recibir fuegos de otros usuarios.
              </p>

              {/* Wallet Address Display */}
              <div className="glass-panel p-4 space-y-3">
                <label className="block text-xs font-medium text-text/60">
                  Tu Dirección de Billetera
                </label>
                <div className="bg-background-dark/50 rounded-lg p-3 break-all font-mono text-sm text-accent">
                  {walletId}
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check size={20} />
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={20} />
                    Copiar Dirección
                  </>
                )}
              </button>

              {/* Info */}
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
                <p className="text-xs text-accent">
                  💡 <strong>Nota:</strong> Otros usuarios necesitarán esta dirección para enviarte fuegos.
                  Las transferencias incluyen una comisión del 5%.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReceiveFiresModal;
