/**
 * Utilidades para limpieza de salas de TicTacToe
 */

const { query, transaction } = require('../db');
const logger = require('./logger');

/**
 * Verifica si un usuario tiene salas activas
 * @param {string} userId - ID del usuario
 * @returns {Promise<Array>} Salas activas del usuario
 */
async function getUserActiveSessions(userId) {
  const result = await query(`
    SELECT * FROM tictactoe_rooms
    WHERE (player_x_id = $1 OR player_o_id = $1)
    AND status IN ('waiting', 'ready', 'playing')
    ORDER BY created_at DESC
  `, [userId]);
  
  return result.rows;
}

/**
 * Cancela y devuelve apuestas de una sala
 * @param {object} room - Sala a cancelar
 * @param {object} client - Cliente de transaction (opcional)
 */
async function cancelRoomAndRefund(room, client = null) {
  const executeQuery = client ? client.query.bind(client) : query;
  
  try {
    // Devolver apuesta al host (player_x)
    if (room.player_x_id) {
      const refundAmount = parseFloat(room.bet_amount);
      const currency = room.mode;
      
      await executeQuery(`
        UPDATE wallets
        SET ${currency}_balance = ${currency}_balance + $1,
            updated_at = NOW()
        WHERE user_id = $2
      `, [refundAmount, room.player_x_id]);
      
      // Registrar transacción
      const walletResult = await executeQuery(
        'SELECT id, ' + currency + '_balance FROM wallets WHERE user_id = $1',
        [room.player_x_id]
      );
      
      if (walletResult.rows.length > 0) {
        const wallet = walletResult.rows[0];
        await executeQuery(`
          INSERT INTO wallet_transactions 
          (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
          VALUES ($1, 'refund', $2, $3, $4, $5, $6, $7)
        `, [
          wallet.id,
          currency,
          refundAmount,
          wallet[currency + '_balance'] - refundAmount,
          wallet[currency + '_balance'],
          'Devolución sala TicTacToe cancelada',
          room.code
        ]);
      }
    }
    
    // Devolver apuesta al invitado (player_o) si existe
    if (room.player_o_id) {
      const refundAmount = parseFloat(room.bet_amount);
      const currency = room.mode;
      
      await executeQuery(`
        UPDATE wallets
        SET ${currency}_balance = ${currency}_balance + $1,
            updated_at = NOW()
        WHERE user_id = $2
      `, [refundAmount, room.player_o_id]);
      
      // Registrar transacción
      const walletResult = await executeQuery(
        'SELECT id, ' + currency + '_balance FROM wallets WHERE user_id = $1',
        [room.player_o_id]
      );
      
      if (walletResult.rows.length > 0) {
        const wallet = walletResult.rows[0];
        await executeQuery(`
          INSERT INTO wallet_transactions 
          (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
          VALUES ($1, 'refund', $2, $3, $4, $5, $6, $7)
        `, [
          wallet.id,
          currency,
          refundAmount,
          wallet[currency + '_balance'] - refundAmount,
          wallet[currency + '_balance'],
          'Devolución sala TicTacToe cancelada',
          room.code
        ]);
      }
    }
    
    // Marcar sala como cancelada
    await executeQuery(`
      UPDATE tictactoe_rooms
      SET status = 'cancelled',
          finished_at = NOW()
      WHERE id = $1
    `, [room.id]);
    
    logger.info('TicTacToe room cancelled and refunded', {
      roomId: room.id,
      code: room.code,
      hostId: room.player_x_id,
      guestId: room.player_o_id
    });
    
    return true;
  } catch (error) {
    logger.error('Error cancelling room:', error);
    throw error;
  }
}

/**
 * Cierra salas anteriores del usuario al crear una nueva
 * @param {string} userId - ID del usuario
 * @param {object} client - Cliente de transaction
 * @param {string} excludeRoomId - ID de sala a excluir (para no cerrar sala a la que se une)
 */
async function closeUserPreviousRooms(userId, client, excludeRoomId = null) {
  const activeSessions = await client.query(`
    SELECT * FROM tictactoe_rooms
    WHERE (player_x_id = $1 OR player_o_id = $1)
    AND status IN ('waiting', 'ready')
    ${excludeRoomId ? 'AND id != $2' : ''}
    ORDER BY created_at DESC
  `, excludeRoomId ? [userId, excludeRoomId] : [userId]);
  
  for (const room of activeSessions.rows) {
    await cancelRoomAndRefund(room, client);
  }
  
  logger.info('Closed previous rooms for user', {
    userId,
    excludedRoom: excludeRoomId,
    roomsClosed: activeSessions.rows.length
  });
}

/**
 * Limpia salas huérfanas (sin jugadores o muy antiguas)
 * @param {number} maxAgeHours - Edad máxima en horas para salas waiting
 * @returns {Promise<number>} Número de salas limpiadas
 */
async function cleanupOrphanedRooms(maxAgeHours = 24) {
  try {
    const result = await transaction(async (client) => {
      // Buscar salas huérfanas
      const orphanedRooms = await client.query(`
        SELECT * FROM tictactoe_rooms
        WHERE status IN ('waiting', 'ready')
        AND created_at < NOW() - INTERVAL '${maxAgeHours} hours'
      `);
      
      let cleaned = 0;
      for (const room of orphanedRooms.rows) {
        await cancelRoomAndRefund(room, client);
        cleaned++;
      }
      
      return cleaned;
    });
    
    logger.info('Cleaned up orphaned TicTacToe rooms', { count: result });
    return result;
  } catch (error) {
    logger.error('Error cleaning orphaned rooms:', error);
    throw error;
  }
}

/**
 * Limpia salas finalizadas antiguas (para mantenimiento DB)
 * @param {number} maxAgeDays - Edad máxima en días
 * @returns {Promise<number>} Número de salas eliminadas
 */
async function cleanupOldFinishedRooms(maxAgeDays = 30) {
  try {
    const result = await query(`
      DELETE FROM tictactoe_rooms
      WHERE (
        status IN ('finished', 'cancelled', 'abandoned')
        AND finished_at < NOW() - INTERVAL '${maxAgeDays} days'
      )
      OR (
        archived_at IS NOT NULL
        AND archived_at < NOW() - INTERVAL '${maxAgeDays} days'
      )
      RETURNING id
    `);
    
    logger.info('Deleted old finished TicTacToe rooms', { count: result.rows.length });
    return result.rows.length;
  } catch (error) {
    logger.error('Error deleting old rooms:', error);
    throw error;
  }
}

module.exports = {
  getUserActiveSessions,
  cancelRoomAndRefund,
  closeUserPreviousRooms,
  cleanupOrphanedRooms,
  cleanupOldFinishedRooms
};
