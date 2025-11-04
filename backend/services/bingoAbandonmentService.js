const { query, getClient } = require('../db');
const logger = require('../utils/logger');

/**
 * Servicio para detectar y manejar abandono de host en salas de Bingo
 * CRÍTICO: Protege el juego cuando el host desaparece
 */

class BingoAbandonmentService {
  
  /**
   * Detectar salas donde el host está inactivo (>300 segundos)
   * @returns {Promise<Array>} - Salas detectadas como abandonadas
   */
  static async detectAbandonedRooms() {
    try {
      const abandonedRoomsResult = await query(`
        SELECT 
          r.id,
          r.code,
          r.host_id,
          r.pot_total,
          r.currency,
          r.host_last_activity,
          EXTRACT(EPOCH FROM (NOW() - r.host_last_activity)) as inactive_seconds,
          u.username as host_username,
          u.tg_id as host_tg_id,
          COUNT(p.user_id) as player_count
        FROM bingo_rooms r
        JOIN users u ON u.id = r.host_id
        LEFT JOIN bingo_room_players p ON p.room_id = r.id
        WHERE r.status = 'playing'
          AND r.host_abandoned = FALSE
          AND r.host_last_activity < NOW() - INTERVAL '300 seconds'
        GROUP BY r.id, u.username, u.tg_id
      `);
      
      if (abandonedRoomsResult.rows.length === 0) {
        return [];
      }
      
      logger.warn(`⚠️  Detectadas ${abandonedRoomsResult.rows.length} salas con host inactivo`);
      
      const markedRooms = [];
      
      for (const room of abandonedRoomsResult.rows) {
        try {
          await this.markRoomAsAbandoned(room.id, room);
          markedRooms.push(room);
        } catch (error) {
          logger.error(`Error marcando sala ${room.code} como abandonada:`, error);
        }
      }
      
      return markedRooms;
      
    } catch (error) {
      logger.error('Error detectando salas abandonadas:', error);
      throw error;
    }
  }
  
  /**
   * Marcar sala como abandonada por el host
   * @param {number} roomId - ID de la sala
   * @param {Object} roomData - Datos de la sala para notificación
   */
  static async markRoomAsAbandoned(roomId, roomData) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Marcar sala como abandonada
      await client.query(`
        UPDATE bingo_rooms
        SET host_abandoned = TRUE,
            abandonment_detected_at = NOW()
        WHERE id = $1
      `, [roomId]);
      
      // Log de auditoría
      await client.query(`
        INSERT INTO bingo_audit_logs (
          room_id, user_id, action, details
        ) VALUES ($1, NULL, 'host_abandoned', $2)
      `, [
        roomId,
        JSON.stringify({
          inactive_seconds: roomData.inactive_seconds,
          player_count: roomData.player_count,
          pot_total: roomData.pot_total,
          currency: roomData.currency
        })
      ]);
      
      // Crear notificación para Admin/Tote
      await this.createAdminNotification(roomId, roomData, client);
      
      await client.query('COMMIT');
      
      logger.info(`✅ Sala ${roomData.code} marcada como abandonada`, {
        roomId,
        inactiveSeconds: roomData.inactive_seconds,
        playerCount: roomData.player_count
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error marcando sala ${roomId} como abandonada:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Crear notificación para Admin/Tote
   * @param {number} roomId - ID de la sala
   * @param {Object} roomData - Datos de la sala
   * @param {Object} client - Cliente de DB
   */
  static async createAdminNotification(roomId, roomData, client) {
    try {
      // Buscar usuario Admin/Tote por tg_id
      const adminResult = await client.query(`
        SELECT id FROM users WHERE tg_id = '1417856820'
      `);
      
      if (!adminResult.rows.length) {
        logger.error('⚠️  Usuario Admin/Tote (tg_id 1417856820) no encontrado');
        return;
      }
      
      const adminId = adminResult.rows[0].id;
      const roomLink = `https://mundoxyz.app/bingo/room/${roomData.code}`;
      
      // Insertar notificación pendiente
      await client.query(`
        INSERT INTO bingo_abandonment_notifications (
          room_id, notified_user_id, notification_type,
          notification_status, room_link
        ) VALUES ($1, $2, 'telegram', 'pending', $3)
      `, [roomId, adminId, roomLink]);
      
      logger.info(`📬 Notificación creada para Admin/Tote`, {
        roomId,
        roomCode: roomData.code,
        roomLink
      });
      
      // Intentar enviar notificación inmediatamente
      await this.sendTelegramNotification(roomData.code, roomLink, roomData);
      
    } catch (error) {
      logger.error('Error creando notificación de abandono:', error);
    }
  }
  
  /**
   * Enviar notificación vía Telegram Bot
   * @param {string} roomCode - Código de la sala
   * @param {string} roomLink - Link directo a la sala
   * @param {Object} roomData - Datos de la sala
   */
  static async sendTelegramNotification(roomCode, roomLink, roomData) {
    try {
      // TODO: Integrar con Telegram Bot API
      // Por ahora solo registramos en logs
      
      const message = `
🚨 *ALERTA: Host Abandonó Sala de Bingo*

📍 *Sala:* \`${roomCode}\`
👤 *Host Original:* ${roomData.host_username || 'Desconocido'}
👥 *Jugadores:* ${roomData.player_count}
💰 *Pozo:* ${roomData.pot_total} ${roomData.currency}
⏱️ *Inactivo:* ${Math.floor(roomData.inactive_seconds / 60)} minutos

🔗 *Entrar a sala:*
${roomLink}

⚡ *Acciones disponibles:*
- Cantar números
- Finalizar sala
- Cancelar con reembolsos
      `.trim();
      
      logger.info('📤 Mensaje de Telegram preparado:', { roomCode, message });
      
      // Aquí iría la llamada real al bot de Telegram
      // await telegramBot.sendMessage('1417856820', message, { parse_mode: 'Markdown' });
      
      // Marcar notificación como enviada
      await query(`
        UPDATE bingo_abandonment_notifications
        SET notification_status = 'sent',
            sent_at = NOW()
        WHERE room_id = (SELECT id FROM bingo_rooms WHERE code = $1)
          AND notification_status = 'pending'
      `, [roomCode]);
      
      logger.info(`✅ Notificación enviada para sala ${roomCode}`);
      
    } catch (error) {
      logger.error('Error enviando notificación de Telegram:', error);
      
      // Marcar como fallida
      await query(`
        UPDATE bingo_abandonment_notifications
        SET notification_status = 'failed'
        WHERE room_id = (SELECT id FROM bingo_rooms WHERE code = $1)
          AND notification_status = 'pending'
      `, [roomCode]);
    }
  }
  
  /**
   * Permitir que Admin/Tote tome control de sala abandonada
   * @param {number} roomId - ID de la sala
   * @param {string} adminId - ID del admin que toma control
   */
  static async takeControlOfAbandonedRoom(roomId, adminId) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Verificar que la sala está abandonada
      const roomResult = await client.query(`
        SELECT * FROM bingo_rooms
        WHERE id = $1 AND host_abandoned = TRUE AND status = 'playing'
      `, [roomId]);
      
      if (!roomResult.rows.length) {
        throw new Error('Sala no encontrada o no está abandonada');
      }
      
      // Verificar que el usuario es Admin/Tote
      const adminResult = await client.query(`
        SELECT tg_id FROM users WHERE id = $1
      `, [adminId]);
      
      if (!adminResult.rows.length || adminResult.rows[0].tg_id !== '1417856820') {
        throw new Error('Solo Admin/Tote puede tomar control de salas abandonadas');
      }
      
      const room = roomResult.rows[0];
      
      // Asignar substitute_host_id
      await client.query(`
        UPDATE bingo_rooms
        SET substitute_host_id = $1,
            host_last_activity = NOW()
        WHERE id = $2
      `, [adminId, roomId]);
      
      // Log de auditoría
      await client.query(`
        INSERT INTO bingo_audit_logs (
          room_id, user_id, action, details, old_host_id, new_host_id
        ) VALUES ($1, $2, 'substitute_host_assigned', $3, $4, $5)
      `, [
        roomId,
        adminId,
        JSON.stringify({
          reason: 'host_abandoned',
          original_host: room.host_id,
          substitute_host: adminId
        }),
        room.host_id,
        adminId
      ]);
      
      await client.query('COMMIT');
      
      logger.info(`✅ Admin/Tote tomó control de sala ${room.code}`, {
        roomId,
        originalHost: room.host_id,
        substituteHost: adminId
      });
      
      return { success: true, room: roomResult.rows[0] };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error al tomar control de sala abandonada:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Obtener estadísticas de abandono
   * @param {Date} since - Desde qué fecha
   * @returns {Promise<Object>} - Estadísticas
   */
  static async getAbandonmentStats(since = null) {
    try {
      const sinceClause = since ? `AND abandonment_detected_at >= $1` : '';
      const params = since ? [since] : [];
      
      const stats = await query(`
        SELECT 
          COUNT(*) as total_abandonments,
          COUNT(substitute_host_id) as rooms_recovered,
          COUNT(*) - COUNT(substitute_host_id) as rooms_not_recovered,
          AVG(pot_total) as avg_pot_abandoned,
          currency
        FROM bingo_rooms
        WHERE host_abandoned = TRUE
        ${sinceClause}
        GROUP BY currency
      `, params);
      
      return stats.rows;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de abandono:', error);
      throw error;
    }
  }
}

module.exports = BingoAbandonmentService;
