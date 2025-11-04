/**
 * Script de limpieza automática de salas TicTacToe
 * Puede ejecutarse como cron job
 * 
 * Uso:
 *   node backend/scripts/cleanup-tictactoe-rooms.js
 *   
 * Opciones:
 *   --orphaned-hours=24    - Edad máxima de salas waiting (default: 24 horas)
 *   --finished-days=30     - Edad máxima de salas finished (default: 30 días)
 *   --dry-run              - Mostrar qué se limpiaría sin ejecutar
 */

require('dotenv').config();
const { cleanupOrphanedRooms, cleanupOldFinishedRooms } = require('../utils/tictactoe-cleanup');
const logger = require('../utils/logger');

async function runCleanup() {
  try {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    
    let orphanedHours = 24;
    let finishedDays = 30;
    
    // Parse argumentos
    args.forEach(arg => {
      if (arg.startsWith('--orphaned-hours=')) {
        orphanedHours = parseInt(arg.split('=')[1]);
      }
      if (arg.startsWith('--finished-days=')) {
        finishedDays = parseInt(arg.split('=')[1]);
      }
    });
    
    logger.info('🧹 Iniciando limpieza de salas TicTacToe', {
      orphanedHours,
      finishedDays,
      dryRun
    });
    
    if (dryRun) {
      logger.warn('⚠️  DRY RUN MODE - No se ejecutarán cambios');
      process.exit(0);
    }
    
    // Limpiar salas huérfanas
    logger.info('🔍 Limpiando salas huérfanas (waiting/ready > ' + orphanedHours + 'h)...');
    const orphanedCleaned = await cleanupOrphanedRooms(orphanedHours);
    logger.info(`✅ Limpiadas ${orphanedCleaned} salas huérfanas`);
    
    // Limpiar salas finalizadas antiguas
    logger.info('🔍 Limpiando salas finalizadas antiguas (> ' + finishedDays + ' días)...');
    const finishedDeleted = await cleanupOldFinishedRooms(finishedDays);
    logger.info(`✅ Eliminadas ${finishedDeleted} salas antiguas`);
    
    logger.info('🎉 Limpieza completada exitosamente', {
      orphanedCleaned,
      finishedDeleted,
      total: orphanedCleaned + finishedDeleted
    });
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Error durante limpieza:', error);
    process.exit(1);
  }
}

runCleanup();
