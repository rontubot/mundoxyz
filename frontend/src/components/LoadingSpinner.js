/**
 * LoadingSpinner.js - Componente reutilizable de carga
 */
import React from 'react';

const LoadingSpinner = ({ size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-10 h-10',
    large: 'w-16 h-16'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-white/20 border-t-purple-500`} />
    </div>
  );
};

export default LoadingSpinner;
