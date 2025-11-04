const logger = require('../utils/logger');

/**
 * Jobs periódicos para limpieza de salas de Bingo V2
 * TEMPORALMENTE DESHABILITADO - Pendiente migración a tablas bingo_v2_*
 */

class BingoCleanupJob {
  
  static intervals = [];
  
  static start() {
    // Temporalmente deshabilitado hasta completar migración a V2
    logger.info('✅ Bingo V2 cleanup jobs - Pendiente implementación');
    logger.info('   - Sistema V2 maneja limpieza internamente');
  }
  
  static stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    logger.info('🛑 Bingo cleanup jobs detenidos');
  }
}

module.exports = BingoCleanupJob;
