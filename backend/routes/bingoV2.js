const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const BingoV2Service = require('../services/bingoV2Service');
const { query } = require('../db');
const logger = require('../utils/logger');

/**
 * Get all active rooms
 */
router.get('/rooms', async (req, res) => {
  try {
    const { mode, currency, status } = req.query;
    
    let sql = `
      SELECT r.*, u.username as host_name,
        (SELECT COUNT(*) FROM bingo_v2_room_players WHERE room_id = r.id) as player_count
      FROM bingo_v2_rooms r
      JOIN users u ON r.host_id = u.id
      WHERE r.status IN ('waiting', 'in_progress')
    `;
    
    const params = [];
    
    if (mode === '75' || mode === '90') {
      sql += ` AND r.mode = $${params.length + 1}`;
      params.push(mode);
    }
    
    if (currency === 'coins' || currency === 'fires') {
      sql += ` AND r.currency_type = $${params.length + 1}`;
      params.push(currency);
    }
    
    sql += ` ORDER BY r.created_at DESC LIMIT 50`;
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      rooms: result.rows
    });
  } catch (error) {
    logger.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Error getting rooms' });
  }
});

/**
 * Get all rooms (admin panel in profile - only for tote/admin roles)
 */
router.get('/my-rooms', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    
    // Verificar si el usuario es admin o tote
    const isAdmin = userRoles.includes('admin') || userRoles.includes('tote');
    
    if (!isAdmin) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        message: 'Solo administradores pueden ver este panel'
      });
    }
    
    // Para admin/tote: mostrar TODAS las salas globales
    const sql = `
      SELECT 
        r.id,
        r.code,
        r.status,
        r.mode,
        r.pattern_type,
        r.currency_type,
        r.card_cost,
        r.total_pot,
        r.host_id,
        r.winner_id,
        r.created_at,
        r.started_at,
        r.finished_at,
        u.username as host_name,
        w.username as winner_name,
        (SELECT COUNT(*) FROM bingo_v2_room_players WHERE room_id = r.id) as player_count,
        (SELECT COUNT(*) FROM bingo_v2_room_players WHERE room_id = r.id AND cards_purchased > 0) as players_with_cards,
        (SELECT SUM(total_spent) FROM bingo_v2_room_players WHERE room_id = r.id) as total_collected
      FROM bingo_v2_rooms r
      LEFT JOIN users u ON r.host_id = u.id
      LEFT JOIN users w ON r.winner_id = w.id
      ORDER BY 
        CASE 
          WHEN r.status = 'waiting' THEN 1
          WHEN r.status = 'in_progress' THEN 2
          WHEN r.status = 'finished' THEN 3
          ELSE 4
        END,
        r.created_at DESC
      LIMIT 100
    `;
    
    const result = await query(sql);
    
    res.json({
      success: true,
      rooms: result.rows,
      isAdmin: true
    });
  } catch (error) {
    logger.error('Error getting admin rooms:', error);
    res.status(500).json({ 
      error: 'Error getting rooms',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Create a new room
 */
router.post('/rooms', verifyToken, async (req, res) => {
  try {
    const room = await BingoV2Service.createRoom(req.user.id, {
      ...req.body,
      host_name: req.user.username
    });
    
    res.json({
      success: true,
      room
    });
  } catch (error) {
    logger.error('Error creating room:', error);
    res.status(500).json({ error: error.message || 'Error creating room' });
  }
});

/**
 * Join a room
 */
router.post('/rooms/:code/join', verifyToken, async (req, res) => {
  try {
    const { cards_count = 1 } = req.body;
    const result = await BingoV2Service.joinRoom(
      req.params.code,
      req.user.id,
      cards_count
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error joining room:', error);
    res.status(500).json({ error: error.message || 'Error joining room' });
  }
});

/**
 * Get room details
 */
router.get('/rooms/:code', async (req, res) => {
  try {
    const room = await BingoV2Service.getRoomDetails(req.params.code);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({
      success: true,
      room
    });
  } catch (error) {
    logger.error('Error getting room:', error);
    res.status(500).json({ error: 'Error getting room details' });
  }
});

/**
 * Get user's active rooms (rooms where user has purchased cards and game is waiting/in_progress)
 */
router.get('/active-rooms', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        r.id,
        r.code,
        r.mode,
        r.pattern_type,
        r.status,
        r.currency_type,
        r.card_cost,
        r.max_players,
        r.total_pot,
        r.created_at,
        u.username as host_name,
        p.cards_purchased,
        (SELECT COUNT(*) FROM bingo_v2_room_players WHERE room_id = r.id) as current_players
       FROM bingo_v2_rooms r
       JOIN users u ON r.host_id = u.id
       JOIN bingo_v2_room_players p ON p.room_id = r.id AND p.user_id = $1
       WHERE r.status IN ('waiting', 'in_progress')
         AND p.cards_purchased > 0
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    
    res.json({
      success: true,
      rooms: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Error getting active rooms:', error);
    res.status(500).json({ error: 'Error getting active rooms' });
  }
});

/**
 * Get user messages/inbox
 */
router.get('/messages', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM bingo_v2_messages 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [req.user.id]
    );
    
    // Get unread count
    const unreadResult = await query(
      `SELECT COUNT(*) as count FROM bingo_v2_messages 
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    
    res.json({
      success: true,
      messages: result.rows,
      unread_count: parseInt(unreadResult.rows[0].count)
    });
  } catch (error) {
    logger.error('Error getting messages:', error);
    res.status(500).json({ error: 'Error getting messages' });
  }
});

/**
 * Mark message as read
 */
router.put('/messages/:id/read', verifyToken, async (req, res) => {
  try {
    await query(
      `UPDATE bingo_v2_messages 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Error updating message' });
  }
});

/**
 * Delete message
 */
router.delete('/messages/:id', verifyToken, async (req, res) => {
  try {
    await query(
      `DELETE FROM bingo_v2_messages 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Error deleting message' });
  }
});

/**
 * Get user experience and stats
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT experience, total_games_played, total_games_won 
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: 'Error getting stats' });
  }
});

/**
 * Check if user can close a room
 */
router.get('/rooms/:code/can-close', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Get room ID
    const roomResult = await query(
      `SELECT id FROM bingo_v2_rooms WHERE code = $1`,
      [code]
    );
    
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const result = await BingoV2Service.canCloseRoom(
      roomResult.rows[0].id,
      req.user.id
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error checking if can close room:', error);
    res.status(500).json({ error: 'Error checking permissions' });
  }
});

/**
 * Close a room and refund all players (host or admin/tote)
 */
router.delete('/rooms/:code', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('tote');
    
    // Get room ID
    const roomResult = await query(
      `SELECT id FROM bingo_v2_rooms WHERE code = $1`,
      [code]
    );
    
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    
    const roomId = roomResult.rows[0].id;
    
    // Check if user can close (admin/tote always can)
    const canClose = await BingoV2Service.canCloseRoom(roomId, req.user.id, isAdmin);
    
    if (!canClose.allowed) {
      return res.status(403).json({ error: canClose.reason });
    }
    
    // Close room and refund (pasar info de admin)
    const result = await BingoV2Service.cancelRoom(
      roomId,
      isAdmin ? 'admin_forced' : 'host_closed',
      req.user.id,
      isAdmin // Nuevo parámetro para indicar que es admin
    );
    
    const action = isAdmin ? 'Admin' : 'Host';
    logger.info(`${action} ${req.user.username || req.user.id} closed room #${code}`);
    
    res.json({
      success: true,
      message: `Sala cerrada. ${result.refunded} jugador(es) reembolsados.`,
      ...result
    });
  } catch (error) {
    logger.error('Error closing room:', error);
    res.status(500).json({ error: error.message || 'Error cerrando sala' });
  }
});

/**
 * ADMIN ONLY: Emergency refund for a room
 */
router.post('/admin/rooms/:code/emergency-refund', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const adminResult = await query(
      `SELECT role FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    if (adminResult.rows.length === 0 || adminResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    
    const { code } = req.params;
    const { reason, notes } = req.body;
    
    // Get room ID
    const roomResult = await query(
      `SELECT id FROM bingo_v2_rooms WHERE code = $1`,
      [code]
    );
    
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    
    const roomId = roomResult.rows[0].id;
    
    // Force refund
    const result = await BingoV2Service.cancelRoom(
      roomId,
      reason || 'admin_forced',
      req.user.id
    );
    
    logger.warn(`ADMIN ${req.user.id} forced refund for room #${code}. Reason: ${reason}. Notes: ${notes}`);
    
    res.json({
      success: true,
      message: `Reembolso administrativo completado. ${result.refunded} jugador(es) reembolsados.`,
      ...result
    });
  } catch (error) {
    logger.error('Error in admin emergency refund:', error);
    res.status(500).json({ error: error.message || 'Error en reembolso administrativo' });
  }
});

/**
 * ADMIN ONLY: Detect and list system failures
 */
router.get('/admin/detect-failures', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const adminResult = await query(
      `SELECT role FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    if (adminResult.rows.length === 0 || adminResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    
    const failedRooms = await BingoV2Service.detectSystemFailures();
    
    res.json({
      success: true,
      failedRooms,
      count: failedRooms.length
    });
  } catch (error) {
    logger.error('Error detecting failures:', error);
    res.status(500).json({ error: 'Error detectando fallas' });
  }
});

module.exports = router;
