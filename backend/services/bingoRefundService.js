const { query, getClient } = require('../db');
const logger = require('../utils/logger');

/**
 * Servicio de reembolso automático para salas de Bingo
 * CRÍTICO: Protege el dinero de los usuarios
 */

class BingoRefundService {
  
  /**
   * Reembolsar una sala completa a todos los jugadores
   * @param {number} roomId - ID de la sala
   * @param {string} reason - Razón del reembolso
   * @returns {Promise<Object>} - Resultado del reembolso
   */
  static async refundRoom(roomId, reason) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Obtener información de la sala
      const roomResult = await client.query(`
        SELECT 
          id, code, host_id, currency, status, pot_total, created_at
        FROM bingo_rooms 
        WHERE id = $1
      `, [roomId]);
      
      if (!roomResult.rows.length) {
        throw new Error(`Sala ${roomId} no encontrada`);
      }
      
      const room = roomResult.rows[0];
      
      // No reembolsar salas ya finalizadas o canceladas
      if (room.status === 'finished' || room.status === 'cancelled') {
        logger.info(`Sala ${room.code} ya está ${room.status}, no se reembolsa`);
        return { success: false, reason: 'already_processed' };
      }
      
      // Obtener todas las transacciones de compra de cartones
      const transactionsResult = await client.query(`
        SELECT 
          user_id,
          SUM(amount) as total_spent
        FROM bingo_transactions
        WHERE room_id = $1 
        AND type IN ('room_creation', 'card_purchase')
        GROUP BY user_id
      `, [roomId]);
      
      if (transactionsResult.rows.length === 0) {
        logger.warn(`Sala ${room.code} sin transacciones para reembolsar`);
      }
      
      const refundedUsers = [];
      
      // Reembolsar a cada jugador
      for (const tx of transactionsResult.rows) {
        const refundAmount = parseFloat(tx.total_spent);
        
        if (refundAmount <= 0) {
          continue;
        }
        
        // Obtener balance actual
        const walletResult = await client.query(`
          SELECT ${room.currency}_balance as balance
          FROM wallets
          WHERE user_id = $1
        `, [tx.user_id]);
        
        const currentBalance = parseFloat(walletResult.rows[0]?.balance || 0);
        const newBalance = currentBalance + refundAmount;
        
        // Devolver dinero
        await client.query(`
          UPDATE wallets
          SET ${room.currency}_balance = $1
          WHERE user_id = $2
        `, [newBalance, tx.user_id]);
        
        // Registrar transacción de refund
        await client.query(`
          INSERT INTO wallet_transactions (
            wallet_id, type, currency, amount,
            balance_before, balance_after, description, reference
          ) VALUES (
            (SELECT id FROM wallets WHERE user_id = $1),
            'refund', $2, $3, $4, $5, $6, $7
          )
        `, [
          tx.user_id,
          room.currency,
          refundAmount,
          currentBalance,
          newBalance,
          `Reembolso sala Bingo ${room.code} - ${reason}`,
          room.code
        ]);
        
        // Registrar transacción en bingo
        await client.query(`
          INSERT INTO bingo_transactions (
            room_id, user_id, type, amount, currency, description
          ) VALUES ($1, $2, 'refund', $3, $4, $5)
        `, [
          roomId,
          tx.user_id,
          refundAmount,
          room.currency,
          `Reembolso automático - ${reason}`
        ]);
        
        refundedUsers.push({
          userId: tx.user_id,
          amount: refundAmount,
          currency: room.currency
        });
        
        logger.info(`Refund ${refundAmount} ${room.currency} to user ${tx.user_id} from room ${room.code}`);
      }
      
      // Marcar sala como cancelada
      await client.query(`
        UPDATE bingo_rooms
        SET status = 'cancelled',
            ended_at = NOW()
        WHERE id = $1
      `, [roomId]);
      
      // Log de auditoría
      await client.query(`
        INSERT INTO bingo_audit_logs (
          room_id, user_id, action, details
        ) VALUES ($1, NULL, 'room_refunded', $2)
      `, [
        roomId,
        JSON.stringify({ 
          reason, 
          refundedUsers: refundedUsers.length,
          totalAmount: refundedUsers.reduce((sum, u) => sum + u.amount, 0)
        })
      ]);
      
      await client.query('COMMIT');
      
      logger.info(`✅ Sala ${room.code} reembolsada: ${refundedUsers.length} usuarios, razón: ${reason}`);
      
      return { 
        success: true, 
        roomCode: room.code,
        refundedUsers,
        reason 
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error refunding room ${roomId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Buscar y reembolsar salas abandonadas (inactivas > 30 min)
   * @returns {Promise<Object>} - Estadísticas del reembolso
   */
  static async refundAbandonedRooms() {
    try {
      // Buscar salas abandonadas (sin actividad en 30 minutos)
      const abandonedRoomsResult = await query(`
        SELECT id, code, status, created_at, last_activity
        FROM bingo_rooms
        WHERE status IN ('lobby', 'waiting', 'ready')
        AND last_activity < NOW() - INTERVAL '30 minutes'
        AND created_at > NOW() - INTERVAL '24 hours'
      `);
      
      const results = [];
      
      for (const room of abandonedRoomsResult.rows) {
        try {
          const result = await this.refundRoom(room.id, 'abandoned_timeout');
          results.push(result);
        } catch (error) {
          logger.error(`Error refunding abandoned room ${room.code}:`, error);
        }
      }
      
      const successful = results.filter(r => r.success).length;
      
      logger.info(`🧹 Cleanup: ${successful}/${abandonedRoomsResult.rows.length} salas abandonadas reembolsadas`);
      
      return { 
        total: abandonedRoomsResult.rows.length,
        refunded: successful,
        results 
      };
    } catch (error) {
      logger.error('Error refunding abandoned rooms:', error);
      throw error;
    }
  }
  
  /**
   * Reembolsar salas interrumpidas por caída del servidor
   * Se ejecuta al iniciar el servidor
   * @returns {Promise<Object>} - Estadísticas del reembolso
   */
  static async refundInterruptedRooms() {
    try {
      // Buscar salas que estaban en juego (probablemente interrumpidas)
      const interruptedRoomsResult = await query(`
        SELECT id, code, status, created_at, last_activity
        FROM bingo_rooms
        WHERE status = 'playing'
        AND last_activity < NOW() - INTERVAL '5 minutes'
      `);
      
      const results = [];
      
      for (const room of interruptedRoomsResult.rows) {
        try {
          const result = await this.refundRoom(room.id, 'game_interrupted');
          results.push(result);
        } catch (error) {
          logger.error(`Error refunding interrupted room ${room.code}:`, error);
        }
      }
      
      const successful = results.filter(r => r.success).length;
      
      logger.info(`🔄 Recovery: ${successful}/${interruptedRoomsResult.rows.length} salas interrumpidas reembolsadas`);
      
      return { 
        total: interruptedRoomsResult.rows.length,
        refunded: successful,
        results 
      };
    } catch (error) {
      logger.error('Error refunding interrupted rooms:', error);
      throw error;
    }
  }
  
  /**
   * Obtener estadísticas de refunds
   * @param {Date} since - Desde qué fecha
   * @returns {Promise<Object>} - Estadísticas
   */
  static async getRefundStats(since = null) {
    try {
      const sinceClause = since ? `AND created_at >= $1` : '';
      const params = since ? [since] : [];
      
      const stats = await query(`
        SELECT 
          COUNT(*) as total_refunds,
          SUM(amount) as total_amount,
          currency,
          COUNT(DISTINCT room_id) as rooms_refunded,
          COUNT(DISTINCT user_id) as users_refunded
        FROM bingo_transactions
        WHERE type = 'refund'
        ${sinceClause}
        GROUP BY currency
      `, params);
      
      return stats.rows;
    } catch (error) {
      logger.error('Error getting refund stats:', error);
      throw error;
    }
  }
}

module.exports = BingoRefundService;
