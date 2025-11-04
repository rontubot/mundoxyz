const { query } = require('../db');
const logger = require('./logger');
const BingoRefundService = require('../services/bingoRefundService');

/**
 * Sistema de recuperación de salas de Bingo al reiniciar servidor
 * CRÍTICO: Previene pérdida de dinero de usuarios
 */

/**
 * Recuperar salas activas después de reinicio del servidor
 * - Salas recientes (<5 min inactivas): Se mantienen activas
 * - Salas abandonadas (>30 min inactivas): Se reembolsan
 * - Salas en juego interrumpidas: Se reembolsan
 */
async function recoverActiveBingoRooms() {
  try {
    logger.info('🔄 Iniciando recuperación de salas de Bingo...');
    
    // 1. Obtener todas las salas no finalizadas
    const activeRoomsResult = await query(`
      SELECT 
        id, code, host_id, status, 
        created_at, last_activity,
        EXTRACT(EPOCH FROM (NOW() - last_activity)) as inactive_seconds
      FROM bingo_v2_rooms
      WHERE status IN ('waiting', 'in_progress')
      AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `);
    
    if (activeRoomsResult.rows.length === 0) {
      logger.info('✅ No hay salas activas para recuperar');
      return { recovered: 0, refunded: 0 };
    }
    
    logger.info(`📊 Encontradas ${activeRoomsResult.rows.length} salas activas`);
    
    const stats = {
      recovered: 0,
      refunded: 0,
      errors: 0
    };
    
    for (const room of activeRoomsResult.rows) {
      try {
        const inactiveMinutes = Math.floor(room.inactive_seconds / 60);
        
        // Sala en juego = siempre reembolsar (probablemente interrumpida)
        if (room.status === 'playing') {
          logger.warn(`⚠️  Sala ${room.code} estaba jugando al reiniciar (inactiva ${inactiveMinutes}m) - REEMBOLSANDO`);
          await BingoRefundService.refundRoom(room.id, 'game_interrupted_restart');
          stats.refunded++;
          continue;
        }
        
        // Salas muy inactivas = abandonadas, reembolsar
        if (inactiveMinutes > 30) {
          logger.warn(`⚠️  Sala ${room.code} abandonada (inactiva ${inactiveMinutes}m) - REEMBOLSANDO`);
          await BingoRefundService.refundRoom(room.id, 'abandoned_after_restart');
          stats.refunded++;
          continue;
        }
        
        // Salas recientes = mantener activas
        logger.info(`✅ Sala ${room.code} recuperada (inactiva ${inactiveMinutes}m)`);
        await query(`
          UPDATE bingo_rooms 
          SET last_activity = NOW() 
          WHERE id = $1
        `, [room.id]);
        stats.recovered++;
        
      } catch (error) {
        logger.error(`Error procesando sala ${room.code}:`, error);
        stats.errors++;
      }
    }
    
    logger.info('✅ Recuperación completada:', stats);
    
    return stats;
    
  } catch (error) {
    logger.error('❌ Error en recuperación de salas:', error);
    throw error;
  }
}

/**
 * Cleanup de salas muy antiguas (>7 días finalizadas)
 */
async function cleanupOldRooms() {
  try {
    const result = await query(`
      DELETE FROM bingo_v2_rooms
      WHERE status IN ('finished', 'cancelled')
      AND finished_at < NOW() - INTERVAL '7 days'
      RETURNING id, code
    `);
    
    if (result.rows.length > 0) {
      logger.info(`🧹 Eliminadas ${result.rows.length} salas antiguas`);
    }
    
    return { deleted: result.rows.length };
  } catch (error) {
    logger.error('Error en cleanup de salas:', error);
    throw error;
  }
}

/**
 * Inicialización completa del sistema de recuperación
 * Se ejecuta al iniciar el servidor
 */
async function initializeBingoRecovery() {
  try {
    logger.info('🚀 Inicializando sistema de recuperación de Bingo...');
    
    // 1. Recuperar/reembolsar salas activas
    const recoveryStats = await recoverActiveBingoRooms();
    
    // 2. Reembolsar salas interrumpidas específicamente
    const interruptedStats = await BingoRefundService.refundInterruptedRooms();
    
    // 3. Cleanup de salas antiguas
    const cleanupStats = await cleanupOldRooms();
    
    const summary = {
      recovered: recoveryStats.recovered,
      refunded: recoveryStats.refunded + interruptedStats.refunded,
      cleaned: cleanupStats.deleted,
      errors: recoveryStats.errors
    };
    
    logger.info('✅ Sistema de recuperación inicializado:', summary);
    
    return summary;
    
  } catch (error) {
    logger.error('❌ Error inicializando sistema de recuperación:', error);
    // No fallar el inicio del servidor por esto
    return { error: error.message };
  }
}

module.exports = {
  recoverActiveBingoRooms,
  cleanupOldRooms,
  initializeBingoRecovery
};
