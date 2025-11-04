const BingoV2Service = require('../services/bingoV2Service');
const logger = require('../utils/logger');

/**
 * Job to detect system failures in Bingo V2 rooms
 * Runs every 5 minutes to check for:
 * - Rooms inactive for 15+ minutes
 * - Rooms with disconnected host without auto-call for 10+ minutes
 */
class BingoV2FailureDetectionJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
  }

  /**
   * Start the job
   */
  start() {
    if (this.interval) {
      logger.warn('BingoV2FailureDetectionJob already running');
      return;
    }

    logger.info('BingoV2FailureDetectionJob iniciado - cada 5 minutos');

    // Run immediately
    this.execute();

    // Run every 5 minutes
    this.interval = setInterval(() => {
      this.execute();
    }, 300000); // 5 minutes
  }

  /**
   * Stop the job
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('BingoV2FailureDetectionJob detenido');
    }
  }

  /**
   * Execute failure detection
   */
  async execute() {
    if (this.isRunning) {
      logger.warn('BingoV2FailureDetectionJob already executing, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('Ejecutando detección de fallas en salas de Bingo V2...');

      const failedRooms = await BingoV2Service.detectSystemFailures();

      if (failedRooms.length > 0) {
        logger.warn(`Detectadas ${failedRooms.length} salas con fallas:`);
        
        for (const room of failedRooms) {
          logger.warn(`  - Sala #${room.code}: ${room.failure_reason}`);
          
          // Auto-refund if marked as stalled
          if (room.is_stalled) {
            try {
              const refundResult = await BingoV2Service.cancelRoom(
                room.id,
                'timeout',
                null // System-initiated
              );
              
              logger.info(`  ✓ Sala #${room.code} reembolsada automáticamente: ${refundResult.refunded} jugadores, ${refundResult.totalRefunded} ${room.currency_type}`);
            } catch (err) {
              logger.error(`  ✗ Error reembolsando sala #${room.code}:`, err);
            }
          }
        }
      } else {
        logger.info('No se detectaron salas con fallas');
      }
    } catch (error) {
      logger.error('Error en BingoV2FailureDetectionJob:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new BingoV2FailureDetectionJob();
