const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Welcome events management
router.get('/welcome/events', adminAuth, async (req, res) => {
  try {
    const { includeInactive } = req.query;
    
    let queryStr = `
      SELECT 
        we.*,
        COUNT(wec.user_id) as total_claims,
        SUM(wec.coins_claimed) as total_coins_claimed,
        SUM(wec.fires_claimed) as total_fires_claimed,
        u.username as created_by_username
      FROM welcome_events we
      LEFT JOIN welcome_event_claims wec ON wec.event_id = we.id
      LEFT JOIN users u ON u.id = we.created_by
    `;
    
    if (!includeInactive) {
      queryStr += ' WHERE we.is_active = true';
    }
    
    queryStr += ' GROUP BY we.id, u.username ORDER BY we.created_at DESC';
    
    const result = await query(queryStr);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching welcome events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create welcome event
router.post('/welcome/events', adminAuth, async (req, res) => {
  try {
    const { 
      name, 
      message, 
      coins_amount, 
      fires_amount, 
      duration_hours, 
      max_claims, 
      priority,
      event_type,
      recurrence,
      target_segment,
      min_user_level,
      max_per_user,
      cooldown_hours,
      require_claim,
      auto_send,
      expires_hours
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Event name is required' });
    }
    
    const result = await query(
      `INSERT INTO welcome_events 
       (name, message, coins_amount, fires_amount, duration_hours, max_claims, priority, created_by,
        event_type, recurrence, target_segment, min_user_level, max_per_user, cooldown_hours,
        require_claim, auto_send, expires_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        name,
        message || `Welcome to MUNDOXYZ! Enjoy your bonus of ${coins_amount || 0} coins and ${fires_amount || 0} fires!`,
        coins_amount || 0,
        fires_amount || 0,
        duration_hours || 72,
        max_claims || null,
        priority || 0,
        req.user?.id || null,
        event_type || 'manual',
        recurrence || null,
        JSON.stringify(target_segment || { type: 'all' }),
        min_user_level || 0,
        max_per_user || null,
        cooldown_hours || null,
        require_claim !== undefined ? require_claim : true,
        auto_send || false,
        expires_hours || 72
      ]
    );
    
    logger.info('Welcome event created', { 
      eventId: result.rows[0].id, 
      name,
      eventType: event_type,
      by: req.user?.username 
    });
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating welcome event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update welcome event
router.patch('/welcome/events/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['name', 'message', 'coins_amount', 'fires_amount', 'duration_hours', 'max_claims', 'priority'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount++}`);
        values.push(updates[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE welcome_events 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Record in history
    await query(
      `INSERT INTO welcome_event_history (event_id, action, actor_id, payload)
       VALUES ($1, 'updated', $2, $3)`,
      [id, req.user?.id || null, updates]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating welcome event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Activate welcome event
router.post('/welcome/events/:id/activate', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { starts_at } = req.body;
    
    const result = await transaction(async (client) => {
      // Deactivate all other events
      await client.query('UPDATE welcome_events SET is_active = false WHERE is_active = true');
      
      // Activate this event
      const activateResult = await client.query(
        `UPDATE welcome_events 
         SET is_active = true, 
             starts_at = COALESCE($2, NOW()),
             ends_at = CASE 
               WHEN duration_hours IS NOT NULL 
               THEN COALESCE($2, NOW()) + (duration_hours || ' hours')::interval
               ELSE NULL 
             END
         WHERE id = $1
         RETURNING *`,
        [id, starts_at || null]
      );
      
      if (activateResult.rows.length === 0) {
        throw new Error('Event not found');
      }
      
      // Record in history
      await client.query(
        `INSERT INTO welcome_event_history (event_id, action, actor_id, payload)
         VALUES ($1, 'activated', $2, $3)`,
        [id, req.user?.id || null, { starts_at }]
      );
      
      return activateResult.rows[0];
    });
    
    logger.info('Welcome event activated', { 
      eventId: id, 
      by: req.user?.username 
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Error activating welcome event:', error);
    res.status(500).json({ error: 'Failed to activate event' });
  }
});

// Deactivate welcome event
router.post('/welcome/events/:id/deactivate', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE welcome_events SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Record in history
    await query(
      `INSERT INTO welcome_event_history (event_id, action, actor_id)
       VALUES ($1, 'deactivated', $2)`,
      [id, req.user?.id || null]
    );
    
    logger.info('Welcome event deactivated', { 
      eventId: id, 
      by: req.user?.username 
    });
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error deactivating welcome event:', error);
    res.status(500).json({ error: 'Failed to deactivate event' });
  }
});

// Get system statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = {};
    
    // User stats
    try {
      const userStats = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_24h,
          COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '24 hours' THEN 1 END) as active_users_24h,
          COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d
        FROM users
      `);
      stats.users = userStats.rows[0];
    } catch (userStatsError) {
      logger.warn('Error fetching user stats, using defaults:', userStatsError.message);
      stats.users = {
        total_users: 0,
        new_users_24h: 0,
        active_users_24h: 0,
        active_users_7d: 0
      };
    }
    
    // Economy stats
    try {
      const economyStats = await query(`
        SELECT 
          SUM(coins_balance) as total_coins_circulation,
          SUM(fires_balance) as total_fires_circulation,
          AVG(coins_balance) as avg_coins_balance,
          AVG(fires_balance) as avg_fires_balance
        FROM wallets
      `);
      stats.economy = economyStats.rows[0];
    } catch (economyStatsError) {
      logger.warn('Error fetching economy stats, using defaults:', economyStatsError.message);
      stats.economy = {
        total_coins_circulation: 0,
        total_fires_circulation: 0,
        avg_coins_balance: 0,
        avg_fires_balance: 0
      };
    }
    
    // Supply stats - Crear tabla si no existe
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS fire_supply (
          id INTEGER PRIMARY KEY DEFAULT 1,
          total_max DECIMAL(20, 2) NOT NULL DEFAULT 10000,
          total_emitted DECIMAL(20, 2) NOT NULL DEFAULT 0,
          total_burned DECIMAL(20, 2) NOT NULL DEFAULT 0,
          total_circulating DECIMAL(20, 2) NOT NULL DEFAULT 0,
          total_reserved DECIMAL(20, 2) NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT single_row CHECK (id = 1)
        )
      `);
      
      // Insertar registro inicial si no existe
      await query(`
        INSERT INTO fire_supply (id, total_max, total_emitted, total_burned, total_circulating, total_reserved)
        VALUES (1, 10000, 0, 0, 0, 0)
        ON CONFLICT (id) DO NOTHING
      `);
      
      // Calcular y actualizar valores reales
      await query(`
        UPDATE fire_supply 
        SET 
          total_circulating = COALESCE((SELECT SUM(fires_balance) FROM wallets), 0),
          total_emitted = COALESCE((SELECT SUM(fires_balance) FROM wallets), 0) + COALESCE(total_burned, 0),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);
    } catch (initError) {
      logger.error('Error initializing fire_supply:', initError);
    }
    
    const supplyStats = await query('SELECT * FROM fire_supply WHERE id = 1');
    stats.supply = supplyStats.rows[0] || {
      total_max: 10000,
      total_emitted: 0,
      total_burned: 0,
      total_circulating: 0,
      total_reserved: 0
    };
    
    // Game stats - Con manejo de errores para tablas que no existan
    try {
      const gameStats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM raffles WHERE status = 'active') as active_raffles,
          (SELECT COUNT(*) FROM bingo_v2_rooms) as total_bingo_rooms,
          (SELECT COUNT(*) FROM bingo_v2_rooms WHERE status IN ('waiting', 'playing')) as active_bingo_rooms,
          (SELECT COALESCE(SUM(pot_fires), 0) FROM bingo_v2_rooms WHERE status IN ('waiting', 'playing')) as total_bingo_pot_fires
      `);
      stats.games = gameStats.rows[0];
    } catch (gameStatsError) {
      logger.warn('Error fetching game stats, using defaults:', gameStatsError.message);
      stats.games = {
        active_raffles: 0,
        total_bingo_rooms: 0,
        active_bingo_rooms: 0,
        total_bingo_pot_fires: 0
      };
    }
    
    // Transaction volume (last 24h)
    try {
      const txVolume = await query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN currency = 'fires' THEN amount ELSE 0 END) as fires_volume,
          SUM(CASE WHEN currency = 'coins' THEN amount ELSE 0 END) as coins_volume
        FROM wallet_transactions
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      stats.transactions_24h = txVolume.rows[0];
    } catch (txError) {
      logger.warn('Error fetching transaction stats, using defaults:', txError.message);
      stats.transactions_24h = {
        total_transactions: 0,
        fires_volume: 0,
        coins_volume: 0
      };
    }
    
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get users list (paginated)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      search, 
      role,
      order = 'created_at',
      direction = 'DESC' 
    } = req.query;
    
    let queryStr = `
      SELECT 
        u.id,
        u.tg_id,
        u.username,
        u.display_name,
        u.email,
        u.created_at,
        u.last_seen_at,
        u.is_active,
        u.is_verified,
        w.coins_balance,
        w.fires_balance,
        array_agg(DISTINCT r.name) as roles
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (search) {
      queryStr += ` AND (
        u.username ILIKE $${++paramCount} OR 
        u.display_name ILIKE $${paramCount} OR
        u.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }
    
    if (role) {
      queryStr += ` AND EXISTS (
        SELECT 1 FROM user_roles ur2 
        JOIN roles r2 ON r2.id = ur2.role_id 
        WHERE ur2.user_id = u.id AND r2.name = $${++paramCount}
      )`;
      params.push(role);
    }
    
    queryStr += ` GROUP BY u.id, w.coins_balance, w.fires_balance`;
    
    // Sanitize order column
    const allowedOrderColumns = ['created_at', 'last_seen_at', 'username', 'coins_balance', 'fires_balance'];
    const orderColumn = allowedOrderColumns.includes(order) ? order : 'created_at';
    const orderDirection = direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    queryStr += ` ORDER BY ${orderColumn} ${orderDirection}`;
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await query(queryStr, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(DISTINCT u.id) FROM users u WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countQuery += ` AND (
        u.username ILIKE $1 OR 
        u.display_name ILIKE $1 OR
        u.email ILIKE $1
      )`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await query(countQuery, countParams);
    
    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
