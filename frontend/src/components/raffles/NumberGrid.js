/**
 * NumberGrid.js - Grid interactivo de números de rifa
 * Estados visuales, animaciones, sistema de tickets
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaTicketAlt, FaCheck, FaLock, FaUnlock, 
  FaUser, FaHourglassHalf, FaQrcode, FaEye,
  FaCrown, FaStar, FaGift, FaFire
} from 'react-icons/fa';

const NumberGrid = ({ 
  numbers = [], 
  onNumberClick, 
  userPurchases = [], 
  disabled = false,
  user = null,
  gridSize = 'auto' // auto, small, medium, large
}) => {
  const [hoveredNumber, setHoveredNumber] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid, list, compact

  // Obtener estado visual de un número
  const getNumberStatus = (num) => {
    const numberData = numbers.find(n => n.number === num);
    if (!numberData) return { status: 'loading', label: 'Cargando...' };

    switch (numberData.status) {
      case 'available':
        return { 
          status: 'available', 
          label: 'Disponible',
          icon: FaUnlock,
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          hoverBg: 'hover:bg-green-500/20'
        };
      case 'purchased':
        const isUserPurchase = numberData.purchased_by === user?.id;
        return {
          status: 'purchased',
          label: isUserPurchase ? 'Tuyo' : numberData.purchased_username || 'Comprado',
          icon: isUserPurchase ? FaTicketAlt : FaCheck,
          color: isUserPurchase ? 'text-blue-400' : 'text-gray-400',
          bgColor: isUserPurchase ? 'bg-blue-500/10' : 'bg-gray-500/10',
          borderColor: isUserPurchase ? 'border-blue-500/30' : 'border-gray-500/30',
          hoverBg: disabled ? '' : isUserPurchase ? 'hover:bg-blue-500/20' : 'hover:bg-gray-500/20'
        };
      case 'reserved':
        const isUserReserved = numberData.reserved_by === user?.id;
        return {
          status: 'reserved',
          label: isUserReserved ? 'Reservado por ti' : 'Reservado',
          icon: FaHourglassHalf,
          color: isUserReserved ? 'text-yellow-400' : 'text-orange-400',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/30',
          hoverBg: disabled ? '' : 'hover:bg-orange-500/20'
        };
      default:
        return { status: 'loading', label: 'Cargando...' };
    }
  };

  // Determinar si un número es clickeable
  const isClickable = (num) => {
    if (disabled) return false;
    const status = getNumberStatus(num);
    return status.status === 'available';
  };

  // Configuración de grid según tamaño
  const getGridConfig = () => {
    const totalNumbers = numbers.length;
    
    if (gridSize === 'auto') {
      if (totalNumbers <= 100) return 'grid-cols-10';
      if (totalNumbers <= 500) return 'grid-cols-20';
      if (totalNumbers <= 1000) return 'grid-cols-25';
      return 'grid-cols-30';
    }
    
    const sizeMap = {
      small: 'grid-cols-10',
      medium: 'grid-cols-15',
      large: 'grid-cols-20'
    };
    
    return sizeMap[gridSize] || 'grid-cols-10';
  };

  // Componente de celda individual
  const NumberCell = ({ num, status }) => {
    const [isHovered, setIsHovered] = useState(false);
    const clickable = isClickable(num);
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={clickable ? { scale: 1.05 } : {}}
        whileTap={clickable ? { scale: 0.95 } : {}}
        onClick={() => clickable && onNumberClick && onNumberClick(num)}
        onMouseEnter={() => setHoveredNumber(num)}
        onMouseLeave={() => setHoveredNumber(null)}
        className={`
          relative aspect-square rounded-lg border-2 p-1 flex flex-col items-center justify-center
          transition-all duration-300 cursor-pointer select-none
          ${status.bgColor} ${status.borderColor} ${status.hoverBg || ''}
          ${clickable ? 'hover:shadow-lg' : 'cursor-not-allowed opacity-75'}
        `}
      >
        {/* Badge de estado */}
        {status.status !== 'available' && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
            <status.icon className={`text-xs ${status.color}`} />
          </div>
        )}

        {/* Número principal */}
        <div className="text-lg font-bold text-white leading-none mb-1">
          {num.toString().padStart(Math.max(2, numbers.length.toString().length), '0')}
        </div>

        {/* Icono de estado */}
        <status.icon className={`text-xs ${status.color} mb-1`} />

        {/* Etiqueta */}
        <div className={`text-xs ${status.color} text-center leading-none truncate w-full px-1`}>
          {status.label}
        </div>

        {/* Tooltip en hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 backdrop-blur-sm rounded-lg text-xs text-white whitespace-nowrap z-10"
            >
              <div className="flex flex-col items-center">
                <span className="font-semibold">Número #{num}</span>
                <span className="text-gray-300">{status.label}</span>
                {clickable && (
                  <span className="text-green-400 mt-1">Click para comprar</span>
                )}
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-2 h-2 bg-black/80 rotate-45"></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // Vista de lista
  const ListView = () => {
    const groupedNumbers = numbers.reduce((groups, num) => {
      const status = getNumberStatus(num.number);
      if (!groups[status.status]) {
        groups[status.status] = [];
      }
      groups[status.status].push(num);
      return groups;
    }, {});

    return (
      <div className="space-y-4">
        {/* Números disponibles */}
        {groupedNumbers.available && (
          <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
            <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
              <FaUnlock />
              Disponibles ({groupedNumbers.available.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {groupedNumbers.available.map(num => (
                <button
                  key={num.number}
                  onClick={() => onNumberClick && onNumberClick(num.number)}
                  className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-white font-semibold transition-all duration-300"
                >
                  #{num.number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Números del usuario */}
        {userPurchases.length > 0 && (
          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
              <FaTicketAlt />
              Mis Números ({userPurchases.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {userPurchases.map(num => (
                <div
                  key={num.number}
                  className="px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-white font-semibold flex items-center gap-2"
                >
                  <FaTicketAlt className="text-xs" />
                  #{num.number}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Números reservados */}
        {groupedNumbers.reserved && (
          <div className="p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <h3 className="text-orange-400 font-semibold mb-3 flex items-center gap-2">
              <FaHourglassHalf />
              Reservados ({groupedNumbers.reserved.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {groupedNumbers.reserved.map(num => {
                const isUserReservation = num.reserved_by === user?.id;
                return (
                  <div
                    key={num.number}
                    className={`px-3 py-2 rounded-lg text-white font-semibold flex items-center gap-2 ${
                      isUserReservation 
                        ? 'bg-yellow-500/20 border border-yellow-500/30' 
                        : 'bg-orange-500/20 border border-orange-500/30'
                    }`}
                  >
                    <FaHourglassHalf className="text-xs" />
                    #{num.number}
                    {isUserReservation && <span className="text-xs text-yellow-400">(Tuyo)</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Números comprados por otros */}
        {groupedNumbers.purchased && (
          <div className="p-4 bg-gray-500/10 rounded-xl border border-gray-500/20">
            <h3 className="text-gray-400 font-semibold mb-3 flex items-center gap-2">
              <FaLock />
              Comprados por otros ({groupedNumbers.purchased.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {groupedNumbers.purchased.slice(0, 30).map(num => (
                <div
                  key={num.number}
                  className="px-3 py-2 bg-gray-500/20 border border-gray-500/30 rounded-lg text-white font-semibold text-center"
                >
                  #{num.number}
                </div>
              ))}
              {groupedNumbers.purchased.length > 30 && (
                <div className="px-3 py-2 bg-gray-500/20 border border-gray-500/30 rounded-lg text-white font-semibold text-center">
                  +{groupedNumbers.purchased.length - 30}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Vista compacta
  const CompactView = () => {
    return (
      <div className="space-y-4">
        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {numbers.filter(n => getNumberStatus(n.number).status === 'available').length}
            </div>
            <div className="text-xs text-white/60">Disponibles</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {userPurchases.length}
            </div>
            <div className="text-xs text-white/60">Tuyos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              {numbers.filter(n => getNumberStatus(n.number).status === 'reserved').length}
            </div>
            <div className="text-xs text-white/60">Reservados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">
              {numbers.filter(n => getNumberStatus(n.number).status === 'purchased').length - userPurchases.length}
            </div>
            <div className="text-xs text-white/60">Otros</div>
          </div>
        </div>

        {/* Barras de progreso */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-400">Disponibles</span>
              <span className="text-white/60">
                {((numbers.filter(n => getNumberStatus(n.number).status === 'available').length / numbers.length) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(numbers.filter(n => getNumberStatus(n.number).status === 'available').length / numbers.length) * 100}%` 
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-blue-400">Tus números</span>
              <span className="text-white/60">
                {((userPurchases.length / numbers.length) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(userPurchases.length / numbers.length) * 100}%` 
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Comprados</span>
              <span className="text-white/60">
                {((numbers.filter(n => getNumberStatus(n.number).status === 'purchased').length / numbers.length) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-gray-500 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(numbers.filter(n => getNumberStatus(n.number).status === 'purchased').length / numbers.length) * 100}%` 
                }}
              />
            </div>
          </div>
        </div>

        {/* Acciones rápidas */}
        {userPurchases.length > 0 && (
          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
              <FaTicketAlt />
              Tus Números
            </h3>
            <div className="grid grid-cols-6 gap-2">
              {userPurchases.map(num => (
                <div
                  key={num.number}
                  className="aspect-square bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center"
                >
                  <span className="text-white font-bold text-sm">#{num.number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Generar números si no vienen de props
  const displayNumbers = numbers.length > 0 ? numbers : 
    Array.from({ length: 100 }, (_, i) => ({ number: i, status: 'loading' }));

  return (
    <div className="space-y-6">
      {/* Controles de vista */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
              viewMode === 'grid'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
              viewMode === 'list'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode('compact')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
              viewMode === 'compact'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Compacto
          </button>
        </div>

        <div className="text-white/60 text-sm">
          {numbers.filter(n => getNumberStatus(n.number).status === 'available').length} disponibles / {numbers.length} totales
        </div>
      </div>

      {/* Contenido según vista */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {viewMode === 'grid' && (
            <div className="overflow-x-auto">
              <div className={`inline-grid gap-2 p-4 bg-white/5 rounded-xl min-w-full ${getGridConfig()}`}>
                {displayNumbers.map(num => {
                  const status = getNumberStatus(num.number);
                  return <NumberCell key={num.number} num={num.number} status={status} />;
                })}
              </div>
            </div>
          )}

          {viewMode === 'list' && <ListView />}

          {viewMode === 'compact' && <CompactView />}
        </motion.div>
      </AnimatePresence>

      {/* Leyenda */}
      {viewMode === 'grid' && (
        <div className="flex items-center justify-center space-x-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30"></div>
            <span className="text-green-400">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/30"></div>
            <span className="text-blue-400">Tuyo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500/20 border border-orange-500/30"></div>
            <span className="text-orange-400">Reservado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-500/20 border border-gray-500/30"></div>
            <span className="text-gray-400">Comprado</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NumberGrid;
