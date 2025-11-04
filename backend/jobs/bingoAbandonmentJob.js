const logger = require('../utils/logger');
const BingoAbandonmentService = require('../services/bingoAbandonmentService');

/**
 * Job periódico para detectar abandono de host en salas de Bingo
 * Se ejecuta cada 60 segundos para monitoreo continuo
 */

class BingoAbandonmentJob {
  
  static interval = null;
  
  static start() {
    // Job: Detectar y notificar salas abandonadas (cada 60 segundos)
    this.interval = setInterval(async () => {
      try {
        logger.info('🔍 Verificando salas de Bingo por inactividad de host...');
        
        const abandonedRooms = await BingoAbandonmentService.detectAbandonedRooms();
        
        if (abandonedRooms.length > 0) {
          logger.warn(`⚠️  ${abandonedRooms.length} sala(s) detectada(s) con host inactivo`, {
            rooms: abandonedRooms.map(r => ({
              code: r.code,
              inactiveMinutes: Math.floor(r.inactive_seconds / 60),
              playerCount: r.player_count,
              pot: r.pot_total
            }))
          });
        } else {
          logger.info('✅ Todas las salas activas con host presente');
        }
        
      } catch (error) {
        logger.error('❌ Error en job de detección de abandono:', error);
      }
    }, 60 * 1000); // 60 segundos
    
    logger.info('✅ Bingo Abandonment Job iniciado');
    logger.info('   - Detección de abandono: cada 60 segundos');
    logger.info('   - Umbral de inactividad: 300 segundos (5 minutos)');
  }
  
  static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('🛑 Bingo Abandonment Job detenido');
    }
  }
}

module.exports = BingoAbandonmentJob;
