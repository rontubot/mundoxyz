const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get user profile
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user data with wallet and roles
    const result = await query(
      `SELECT 
        u.id,
        u.xyz_id,
        u.tg_id,
        u.username,
        u.display_name,
        u.email,
        u.avatar_url,
        u.locale,
        u.is_active,
        u.is_verified,
        u.created_at,
        u.last_seen_at,
        u.nickname,
        u.bio,
        u.security_answer,
        u.experience,
        u.total_games_played,
        u.total_games_won,
        w.id as wallet_id,
        w.coins_balance,
        w.fires_balance,
        w.total_coins_earned,
        w.total_fires_earned,
        w.total_coins_spent,
        w.total_fires_spent,
        array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as roles
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id::text = $1 OR u.tg_id::text = $1 OR u.username = $1
      GROUP BY u.id, w.id, w.coins_balance, w.fires_balance, w.total_coins_earned, 
               w.total_fires_earned, w.total_coins_spent, w.total_fires_spent`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if this is the user's own profile or they have permission
    const isOwnProfile = req.user && (
      req.user.id === user.id || 
      req.user.tg_id === user.tg_id
    );
    
    const isAdmin = req.user && (
      req.user.roles?.includes('admin') || 
      req.user.roles?.includes('tote')
    );

    // Build response based on permissions
    const profile = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      nickname: user.nickname,
      bio: user.bio,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      last_seen_at: user.last_seen_at,
      is_verified: user.is_verified,
      roles: user.roles || [],
      // Experiencia y juegos (públicos)
      experience: user.experience || 0,
      total_games_played: user.total_games_played || 0,
      total_games_won: user.total_games_won || 0,
      stats: {
        coins_balance: user.coins_balance || 0,
        fires_balance: user.fires_balance || 0,
        total_coins_earned: user.total_coins_earned || 0,
        total_fires_earned: user.total_fires_earned || 0
      }
    };

    // Add private data if authorized
    if (isOwnProfile || isAdmin) {
      profile.wallet_id = user.wallet_id;
      profile.tg_id = user.tg_id;
      profile.email = user.email;
      profile.locale = user.locale;
      profile.total_coins_spent = user.total_coins_spent || 0;
      profile.total_fires_spent = user.total_fires_spent || 0;
      // Indicar si tiene respuesta de seguridad (sin revelar el valor)
      profile.security_answer = user.security_answer ? true : false;
    }

    // Get recent transactions if own profile
    if (isOwnProfile) {
      const txResult = await query(
        `SELECT 
          wt.id,
          wt.type,
          wt.currency,
          wt.amount,
          wt.balance_after,
          wt.description,
          wt.created_at,
          u2.username as related_username
        FROM wallet_transactions wt
        LEFT JOIN wallets w ON w.id = wt.wallet_id
        LEFT JOIN users u2 ON u2.id = wt.related_user_id
        WHERE w.user_id = $1
        ORDER BY wt.created_at DESC
        LIMIT 10`,
        [user.id]
      );

      profile.recent_transactions = txResult.rows;
    }

    res.json(profile);

  } catch (error) {
    logger.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { display_name, avatar_url, locale, email } = req.body;

    // Check if user can update this profile
    const canUpdate = 
      req.user.id === userId ||
      req.user.tg_id?.toString() === userId ||
      req.user.username === userId ||
      req.user.roles?.includes('admin') ||
      req.user.roles?.includes('tote');

    if (!canUpdate) {
      return res.status(403).json({ error: 'Cannot update this profile' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatar_url);
    }

    if (locale !== undefined) {
      updates.push(`locale = $${paramCount++}`);
      values.push(locale);
    }

    if (email !== undefined && req.user.roles?.includes('admin')) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add user identifier
    values.push(userId);

    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id::text = $${paramCount} OR tg_id::text = $${paramCount} OR username = $${paramCount}
       RETURNING id, username, display_name, avatar_url, locale, email`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user statistics
router.get('/:userId/stats', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT 
        COUNT(DISTINCT r.id) as total_raffles_participated,
        COUNT(DISTINCT CASE WHEN r.winner_id = u.id THEN r.id END) as raffles_won,
        COUNT(DISTINCT b.id) as total_bingo_games,
        COUNT(DISTINCT CASE WHEN b.winner_id = u.id THEN b.id END) as bingo_won,
        COALESCE(SUM(rp.fires_spent), 0) as total_fires_in_raffles,
        COALESCE(SUM(rp.coins_spent), 0) as total_coins_in_raffles,
        COALESCE(SUM(bp.total_spent), 0) as total_fires_in_bingo,
        COALESCE(SUM(bp.total_spent), 0) as total_coins_in_bingo
      FROM users u
      LEFT JOIN raffle_participants rp ON rp.user_id = u.id
      LEFT JOIN raffles r ON r.id = rp.raffle_id
      LEFT JOIN bingo_v2_room_players bp ON bp.user_id = u.id
      LEFT JOIN bingo_v2_rooms b ON b.id = bp.room_id
      WHERE u.id::text = $1 OR u.tg_id::text = $1 OR u.username = $1
      GROUP BY u.id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = result.rows[0];

    // Get achievements
    const achievements = [];
    
    if (stats.raffles_won > 0) {
      achievements.push({
        name: 'Raffle Winner',
        description: `Won ${stats.raffles_won} raffle${stats.raffles_won > 1 ? 's' : ''}`,
        icon: '🎯'
      });
    }

    if (stats.bingo_won > 0) {
      achievements.push({
        name: 'Bingo Master',
        description: `Won ${stats.bingo_won} bingo game${stats.bingo_won > 1 ? 's' : ''}`,
        icon: '🎱'
      });
    }

    if (parseInt(stats.total_raffles_participated) >= 10) {
      achievements.push({
        name: 'Raffle Enthusiast',
        description: 'Participated in 10+ raffles',
        icon: '🎲'
      });
    }

    if (parseInt(stats.total_bingo_games) >= 10) {
      achievements.push({
        name: 'Bingo Regular',
        description: 'Played 10+ bingo games',
        icon: '📋'
      });
    }

    res.json({
      games: {
        raffles: {
          participated: parseInt(stats.total_raffles_participated),
          won: parseInt(stats.raffles_won),
          fires_spent: parseFloat(stats.total_fires_in_raffles),
          coins_spent: parseFloat(stats.total_coins_in_raffles)
        },
        bingo: {
          played: parseInt(stats.total_bingo_games),
          won: parseInt(stats.bingo_won),
          fires_spent: parseFloat(stats.total_fires_in_bingo),
          coins_spent: parseFloat(stats.total_coins_in_bingo)
        }
      },
      achievements
    });

  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get user's active games
router.get('/:userId/games', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check permissions
    const canView = 
      req.user.id === userId ||
      req.user.tg_id?.toString() === userId ||
      req.user.roles?.includes('admin') ||
      req.user.roles?.includes('tote');

    if (!canView) {
      return res.status(403).json({ error: 'Cannot view this user\'s games' });
    }

    // Get active raffles
    const raffles = await query(
      `SELECT 
        r.id,
        r.code,
        r.name,
        r.status,
        r.mode,
        r.visibility,
        r.ends_at,
        rp.numbers,
        rp.fires_spent,
        rp.coins_spent
      FROM raffle_participants rp
      JOIN raffles r ON r.id = rp.raffle_id
      WHERE rp.user_id = $1 AND r.status IN ('pending', 'active')
      ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    // Get active bingo rooms
    const bingo = await query(
      `SELECT 
        br.id,
        br.code,
        br.name,
        br.status,
        br.mode,
        br.is_public as visibility,
        bp.cards_purchased as cards_count,
        bp.is_ready,
        bp.total_spent as fires_spent,
        bp.total_spent as coins_spent
      FROM bingo_v2_room_players bp
      JOIN bingo_v2_rooms br ON br.id = bp.room_id
      WHERE bp.user_id = $1 AND br.status IN ('waiting', 'in_progress')
      ORDER BY br.created_at DESC`,
      [req.user.id]
    );

    res.json({
      raffles: raffles.rows,
      bingo: bingo.rows
    });

  } catch (error) {
    logger.error('Error fetching user games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get user transactions with pagination
router.get('/:userId/transactions', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { currency, limit = 25, offset = 0 } = req.query;

    // Check permissions
    const canView = 
      req.user.id === userId ||
      req.user.tg_id?.toString() === userId ||
      req.user.username === userId ||
      req.user.roles?.includes('admin') ||
      req.user.roles?.includes('tote');

    if (!canView) {
      return res.status(403).json({ error: 'Cannot view this user\'s transactions' });
    }

    // Get user's wallet
    const walletResult = await query(
      'SELECT id FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const walletId = walletResult.rows[0].id;

    // Build query with optional currency filter
    let queryStr = `
      SELECT 
        wt.id,
        wt.type,
        wt.currency,
        wt.amount,
        wt.balance_after,
        wt.description,
        wt.created_at,
        u2.username as related_username
      FROM wallet_transactions wt
      LEFT JOIN users u2 ON u2.id = wt.related_user_id
      WHERE wt.wallet_id = $1
    `;

    const queryParams = [walletId];
    let paramCount = 2;

    if (currency) {
      queryStr += ` AND wt.currency = $${paramCount}`;
      queryParams.push(currency);
      paramCount++;
    }

    queryStr += ` ORDER BY wt.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const transactions = await query(queryStr, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM wallet_transactions WHERE wallet_id = $1';
    const countParams = [walletId];

    if (currency) {
      countQuery += ' AND currency = $2';
      countParams.push(currency);
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      transactions: transactions.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Update user profile (display_name, nickname, email, bio)
router.put('/:userId/update-profile', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { display_name, nickname, email, bio } = req.body;

    // Verify permissions (comparar como string ya que userId puede ser UUID o username)
    if (req.user.id !== userId && req.user.id.toString() !== userId && req.user.username !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Display name
    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }

    // Nickname (validate unique and no offensive words)
    if (nickname !== undefined && nickname !== null && nickname !== '') {
      const { containsOffensiveWords } = require('../utils/offensive-words');
      
      if (nickname.length > 20) {
        return res.status(400).json({ error: 'El alias no puede tener más de 20 caracteres' });
      }

      if (await containsOffensiveWords(nickname)) {
        return res.status(400).json({ error: 'El alias contiene palabras no permitidas' });
      }

      // Check if unique
      const existing = await query(
        'SELECT id FROM users WHERE nickname = $1 AND id != $2',
        [nickname, userId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Este alias ya está en uso' });
      }

      updates.push(`nickname = $${paramCount++}`);
      values.push(nickname);
    }

    // Email (validate unique)
    if (email !== undefined) {
      const existing = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Este email ya está en uso' });
      }

      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    // Bio
    if (bio !== undefined) {
      if (bio.length > 500) {
        return res.status(400).json({ error: 'La biografía no puede tener más de 500 caracteres' });
      }
      updates.push(`bio = $${paramCount++}`);
      values.push(bio);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    // Execute update
    values.push(userId);
    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount}
       RETURNING id, username, display_name, nickname, email, bio`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// Check if password is correct
router.post('/:userId/check-password', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Contraseña requerida' });
    }

    // Usar req.user.id del token (ya verificado por verifyToken)
    // No comparar con userId del params, usar directamente req.user.id
    const actualUserId = req.user.id;

    logger.info('=== CHECK PASSWORD START ===', { 
      userId: actualUserId,
      paramsUserId: userId,
      userType: typeof actualUserId
    });

    // Get user password hash from auth_identities
    const result = await query(
      `SELECT 
         u.id,
         u.username,
         ai.id AS auth_id,
         ai.provider,
         ai.password_hash,
         LENGTH(ai.password_hash) AS hash_length
       FROM users u
       LEFT JOIN auth_identities ai 
         ON ai.user_id = u.id AND ai.provider = 'email'
       WHERE u.id = $1::uuid`,
      [actualUserId]  // Usar siempre el ID del token con cast explícito
    );

    logger.info('Query result', { 
      rowCount: result.rows.length,
      data: result.rows[0] 
    });

    if (result.rows.length === 0) {
      logger.warn('User not found for password check', { userId: actualUserId });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const row = result.rows[0];
    const storedHash = row.password_hash;

    logger.info('Password hash check', {
      hasHash: !!storedHash,
      hashLength: storedHash ? storedHash.length : 0,
      provider: row.provider,
      authId: row.auth_id
    });

    // If no password set anywhere
    if (!storedHash) {
      logger.info('No password set for user', { userId: actualUserId });
      return res.status(400).json({ 
        error: 'No tienes contraseña establecida',
        requiresPasswordCreation: true
      });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(password, storedHash);

    if (!isValid) {
      logger.info('Invalid password attempt', { userId: actualUserId });
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    logger.info('Password verified successfully', { userId: actualUserId });
    res.json({ success: true, valid: true });

  } catch (error) {
    logger.error('Error checking password:', error);
    res.status(500).json({ error: 'Error al verificar contraseña' });
  }
});

// Check if nickname is available
router.get('/check-nickname/:nickname', verifyToken, async (req, res) => {
  try {
    const { nickname } = req.params;

    if (!nickname || nickname.length > 20) {
      return res.json({ available: false, reason: 'Longitud inválida' });
    }

    // Check offensive words
    const { containsOffensiveWords } = require('../utils/offensive-words');
    if (await containsOffensiveWords(nickname)) {
      return res.json({ available: false, reason: 'Contiene palabras no permitidas' });
    }

    // Check if in use
    const result = await query(
      'SELECT id FROM users WHERE nickname = $1',
      [nickname]
    );

    res.json({ 
      available: result.rows.length === 0,
      reason: result.rows.length > 0 ? 'Ya está en uso' : null
    });

  } catch (error) {
    logger.error('Error checking nickname:', error);
    res.status(500).json({ error: 'Error al verificar alias' });
  }
});

// Start Telegram linking (generate token)
router.post('/:userId/link-telegram', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify permissions
    if (req.user.id !== userId && req.user.id.toString() !== userId && req.user.username !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Generate unique token
    const crypto = require('crypto');
    const linkToken = crypto.randomBytes(32).toString('hex');
    
    // Save session (expires in 15 minutes)
    await query(
      `INSERT INTO telegram_link_sessions (user_id, link_token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [userId, linkToken]
    );

    // Bot URL
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'mundoxyz_bot';
    const telegramUrl = `https://t.me/${botUsername}?start=${linkToken}`;

    res.json({
      success: true,
      linkToken,
      telegramUrl,
      expiresIn: 900 // 15 minutes in seconds
    });

  } catch (error) {
    logger.error('Error creating telegram link:', error);
    res.status(500).json({ error: 'Error al crear enlace' });
  }
});

// Link Telegram manually (user provides tg_id)
router.post('/:userId/link-telegram-manual', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { tg_id } = req.body;

    // Verify permissions
    if (req.user.id !== userId && req.user.id.toString() !== userId && req.user.username !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Validate tg_id
    if (!tg_id || isNaN(tg_id)) {
      return res.status(400).json({ error: 'ID de Telegram inválido' });
    }

    // Check if already in use
    const existing = await query(
      'SELECT id FROM users WHERE tg_id = $1 AND id != $2',
      [tg_id, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Este ID de Telegram ya está vinculado a otra cuenta' });
    }

    // Update user
    await query(
      'UPDATE users SET tg_id = $1, updated_at = NOW() WHERE id = $2',
      [tg_id, userId]
    );

    res.json({ success: true, message: 'Telegram vinculado exitosamente' });

  } catch (error) {
    logger.error('Error linking telegram manually:', error);
    res.status(500).json({ error: 'Error al vincular Telegram' });
  }
});

// Unlink Telegram
router.post('/:userId/unlink-telegram', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify permissions
    if (req.user.id !== userId && req.user.id.toString() !== userId && req.user.username !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Update user
    await query(
      'UPDATE users SET tg_id = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    );

    res.json({ success: true, message: 'Telegram desvinculado exitosamente' });

  } catch (error) {
    logger.error('Error unlinking telegram:', error);
    res.status(500).json({ error: 'Error al desvincular Telegram' });
  }
});

module.exports = router;
