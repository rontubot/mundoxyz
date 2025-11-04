const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const net = require('net');
const { query, transaction } = require('../db');
const { verifyTelegramWebAppData, verifyTelegramWidgetData, formatUserIdentifier } = require('../services/telegramAuth');
const { generateToken, generateRefreshToken, verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config/config');
const { hashSecurityAnswer, compareSecurityAnswer, validateSecurityAnswer } = require('../utils/security');

// Helper to sanitize IP into a valid PostgreSQL inet or null
function getClientIp(req) {
  try {
    const hdr = req.headers['x-forwarded-for'];
    const cand = (hdr ? String(hdr).split(',')[0] : req.ip || '').trim();
    if (net.isIP(cand)) return cand;
    // Express sometimes returns IPv6 mapped IPv4 like ::ffff:127.0.0.1 which is valid
    if (cand.startsWith('::ffff:') && net.isIP(cand)) return cand;
  } catch (_) {}
  return null;
}

// Login with Telegram WebApp
router.post('/login-telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ error: 'initData required' });
    }

    // Verify Telegram data
    const telegramData = verifyTelegramWebAppData(initData);
    
    if (!telegramData) {
      return res.status(401).json({ error: 'Invalid Telegram authentication' });
    }

    // Find or create user
    const userId = await findOrCreateTelegramUser(telegramData);
    
    if (!userId) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Generate tokens
    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);

    // Create session
    await query(
      'INSERT INTO user_sessions (user_id, session_token, refresh_token, ip_address, user_agent, expires_at) ' +
      'VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL \'7 days\')',
      [userId, token, refreshToken, getClientIp(req), req.headers['user-agent']]
    );

    // Log connection
    await query(
      'INSERT INTO connection_logs (user_id, event_type, ip_address, user_agent, method, path, status_code) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, 'login', getClientIp(req), req.headers['user-agent'], 'POST', '/api/auth/login-telegram', 200]
    );

    // Get user data
    const userResult = await query(
      'SELECT u.*, w.id as wallet_id, ' +
      'COALESCE(w.coins_balance, 0)::numeric as coins_balance, ' +
      'COALESCE(w.fires_balance, 0)::numeric as fires_balance, ' +
      'u.security_answer IS NOT NULL as has_security_answer, ' +
      'u.experience, u.total_games_played, u.total_games_won, ' +
      'array_agg(r.name) as roles ' +
      'FROM users u ' +
      'LEFT JOIN wallets w ON w.user_id = u.id ' +
      'LEFT JOIN user_roles ur ON ur.user_id = u.id ' +
      'LEFT JOIN roles r ON r.id = ur.role_id ' +
      'WHERE u.id = $1 ' +
      'GROUP BY u.id, w.id, w.coins_balance, w.fires_balance, u.security_answer, u.experience, u.total_games_played, u.total_games_won',
      [userId]
    );

    const user = userResult.rows[0];

    // Set cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.security.cookieSecure,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        tg_id: user.tg_id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        wallet_id: user.wallet_id,
        coins_balance: parseFloat(user.coins_balance || 0),
        fires_balance: parseFloat(user.fires_balance || 0),
        experience: user.experience || 0,
        total_games_played: user.total_games_played || 0,
        total_games_won: user.total_games_won || 0,
        has_security_answer: user.has_security_answer || false,
        roles: user.roles?.filter(Boolean) || []
      }
    });

  } catch (error) {
    logger.error('Telegram login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Login with Email/Username (Dev and regular)
router.post('/login-email', async (req, res) => {
  try {
    const { email, password } = req.body;
    const identifier = (email || '').trim();

    logger.info('login-email request', { identifier: identifier ? identifier.toLowerCase() : '' });

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/usuario y contraseña son requeridos' });
    }

    // Fast path: admin via env headers equivalent
    if (
      config.admin.username &&
      config.admin.code &&
      identifier.toLowerCase() === String(config.admin.username).toLowerCase() &&
      password === config.admin.code
    ) {
      logger.info('login-email using admin fast path');
      // Ensure admin user exists with roles
      const userId = await transaction(async (client) => {
        let uid = null;
        const ures = await client.query(
          'SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
          [config.admin.username]
        );
        if (ures.rows.length > 0) {
          uid = ures.rows[0].id;
        } else {
          const ins = await client.query(
            'INSERT INTO users (id, username, display_name, is_verified, first_seen_at, last_seen_at) ' +
            'VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING id',
            [uuidv4(), config.admin.username, config.admin.username]
          );
          uid = ins.rows[0].id;
          await client.query(
            'INSERT INTO wallets (id, user_id, coins_balance, fires_balance) VALUES ($1, $2, 0, 0) ON CONFLICT DO NOTHING',
            [uuidv4(), uid]
          );
        }

        // Assign roles admin and tote
        const rAdmin = await client.query('SELECT id FROM roles WHERE name = $1', ['admin']);
        const rTote = await client.query('SELECT id FROM roles WHERE name = $1', ['tote']);
        if (rAdmin.rows.length) {
          await client.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [uid, rAdmin.rows[0].id]
          );
        }
        if (rTote.rows.length) {
          await client.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [uid, rTote.rows[0].id]
          );
        }

        return uid;
      });

      logger.info('login-email admin user ensured', { userId });

      // Generate tokens and session
      const token = generateToken(userId);
      const refreshToken = generateRefreshToken(userId);

      await query(
        'INSERT INTO user_sessions (user_id, session_token, refresh_token, ip_address, user_agent, expires_at) ' +
        "VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')",
        [userId, token, refreshToken, getClientIp(req), req.headers['user-agent']]
      );

      logger.info('login-email admin session created', { userId });

      // Get user data
      const userResult = await query(
        'SELECT u.*, w.id as wallet_id, w.coins_balance, w.fires_balance, ' +
        'u.experience, u.total_games_played, u.total_games_won, ' +
        'array_agg(r.name) as roles ' +
        'FROM users u ' +
        'LEFT JOIN wallets w ON w.user_id = u.id ' +
        'LEFT JOIN user_roles ur ON ur.user_id = u.id ' +
        'LEFT JOIN roles r ON r.id = ur.role_id ' +
        'WHERE u.id = $1 ' +
        'GROUP BY u.id, w.id, w.coins_balance, w.fires_balance, u.experience, u.total_games_played, u.total_games_won',
        [userId]
      );

      const user = userResult.rows[0];

      // Set cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.security.cookieSecure,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      const payload = {
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          tg_id: user.tg_id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          wallet_id: user.wallet_id,
          coins_balance: parseFloat(user.coins_balance || 0),
          fires_balance: parseFloat(user.fires_balance || 0),
          experience: user.experience || 0,
          total_games_played: user.total_games_played || 0,
          total_games_won: user.total_games_won || 0,
          roles: user.roles?.filter(Boolean) || []
        }
      };

      logger.info('login-email admin success', { userId });
      return res.json(payload);
    }

    // Regular email/username login with stored password
    logger.info('login-email regular path');
    const result = await query(
      'SELECT u.id, u.username, u.email, ai.password_hash, w.id as wallet_id, ' +
      'COALESCE(w.coins_balance, 0)::numeric as coins_balance, ' +
      'COALESCE(w.fires_balance, 0)::numeric as fires_balance, ' +
      'u.security_answer IS NOT NULL as has_security_answer, ' +
      'u.experience, u.total_games_played, u.total_games_won, ' +
      'array_agg(r.name) as roles ' +
      'FROM users u ' +
      "LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email' " +
      'LEFT JOIN wallets w ON w.user_id = u.id ' +
      'LEFT JOIN user_roles ur ON ur.user_id = u.id ' +
      'LEFT JOIN roles r ON r.id = ur.role_id ' +
      'WHERE LOWER(u.email) = LOWER($1) OR LOWER(u.username) = LOWER($1) OR ai.provider_uid = $1 ' +
      'GROUP BY u.id, ai.password_hash, w.id, w.coins_balance, w.fires_balance, u.security_answer, u.experience, u.total_games_played, u.total_games_won',
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const row = result.rows[0];
    if (!row.password_hash) {
      return res.status(401).json({ error: 'Usuario sin contraseña configurada' });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const userId = row.id;
    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);

    await query(
      'INSERT INTO user_sessions (user_id, session_token, refresh_token, ip_address, user_agent, expires_at) ' +
      "VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')",
      [userId, token, refreshToken, getClientIp(req), req.headers['user-agent']]
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.security.cookieSecure,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const payload = {
      success: true,
      token,
      refreshToken,
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        wallet_id: row.wallet_id,
        coins_balance: parseFloat(row.coins_balance || 0),
        fires_balance: parseFloat(row.fires_balance || 0),
        experience: row.experience || 0,
        total_games_played: row.total_games_played || 0,
        total_games_won: row.total_games_won || 0,
        has_security_answer: row.has_security_answer || false,
        roles: (row.roles || []).filter(Boolean)
      }
    };
    logger.info('login-email regular success', { userId });
    return res.json(payload);
  } catch (error) {
    logger.error('Email login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register new user with email
router.post('/register', async (req, res) => {
  try {
    const { username, email, emailConfirm, password, passwordConfirm, tg_id, security_answer } = req.body;

    // Validaciones básicas
    if (!username || !email || !emailConfirm || !password || !passwordConfirm || !security_answer) {
      return res.status(400).json({ error: 'Todos los campos son requeridos excepto ID Telegram' });
    }
    
    // Validar respuesta de seguridad
    const answerValidation = validateSecurityAnswer(security_answer);
    if (!answerValidation.valid) {
      return res.status(400).json({ error: answerValidation.error });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    // Validar confirmación de email
    if (email !== emailConfirm) {
      return res.status(400).json({ error: 'Los emails no coinciden' });
    }

    // Validar confirmación de contraseña
    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Validar username
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'El usuario debe tener entre 3 y 20 caracteres' });
    }

    // Validar caracteres del username (solo alfanuméricos y guiones bajos)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'El usuario solo puede contener letras, números y guiones bajos' });
    }

    // Validar tg_id si se proporciona
    let telegramId = null;
    if (tg_id) {
      const parsedTgId = parseInt(tg_id, 10);
      if (isNaN(parsedTgId) || parsedTgId <= 0) {
        return res.status(400).json({ error: 'ID de Telegram inválido' });
      }
      telegramId = parsedTgId;
    }

    const result = await transaction(async (client) => {
      // Verificar si el username ya existe
      const usernameCheck = await client.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      );

      if (usernameCheck.rows.length > 0) {
        throw new Error('El usuario ya está registrado');
      }

      // Verificar si el email ya existe
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (emailCheck.rows.length > 0) {
        throw new Error('El email ya está registrado');
      }

      // Verificar si el tg_id ya existe (si se proporcionó)
      if (telegramId) {
        const tgCheck = await client.query(
          'SELECT id FROM users WHERE tg_id = $1',
          [telegramId]
        );

        if (tgCheck.rows.length > 0) {
          throw new Error('El ID de Telegram ya está registrado');
        }
      }

      // Hash de la contraseña
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Hash de la respuesta de seguridad
      const securityAnswerHash = await hashSecurityAnswer(security_answer);

      // Crear usuario
      const userResult = await client.query(
        `INSERT INTO users (username, email, tg_id, display_name, security_answer, is_verified, created_at, first_seen_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW(), NOW())
         RETURNING id, username, email, tg_id`,
        [username, email.toLowerCase(), telegramId, username, securityAnswerHash]
      );

      const userId = userResult.rows[0].id;

      // Crear auth_identity con contraseña
      await client.query(
        `INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at)
         VALUES ($1, 'email', $2, $3, NOW())`,
        [userId, email.toLowerCase(), passwordHash]
      );

      // Crear wallet del usuario
      await client.query(
        `INSERT INTO wallets (id, user_id, fires_balance, coins_balance)
         VALUES ($1, $2, 0, 0)`,
        [uuidv4(), userId]
      );

      // Asignar rol de usuario regular
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = 'user'
         ON CONFLICT DO NOTHING`,
        [userId]
      );

      // Registrar en supply_txs (registro de creación de cuenta)
      await client.query(
        `INSERT INTO supply_txs (type, currency, amount, user_id, user_ext, description, ip_address)
         VALUES ('account_created', 'coins', 0, $1, $2, 'Nueva cuenta registrada', $3)`,
        [userId, `email:${email}`, getClientIp(req)]
      );

      logger.info('User registered successfully', { userId, username, email });

      return userResult.rows[0];
    });

    // Procesar eventos de first_login de forma asíncrona (no bloquear respuesta)
    const giftService = require('../services/giftService');
    setImmediate(async () => {
      try {
        await giftService.processFirstLoginEvents(result.id);
      } catch (error) {
        logger.error('Error processing first login events in background:', error);
      }
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Por favor inicia sesión.',
      user: {
        id: result.id,
        username: result.username,
        email: result.email
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    
    // Manejar errores específicos
    if (error.message.includes('ya está registrado')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login with Telegram Widget
router.post('/login-telegram-widget', async (req, res) => {
  try {
    const widgetData = req.body;
    
    if (!widgetData || !widgetData.id) {
      return res.status(400).json({ error: 'Invalid widget data' });
    }

    // Verify Telegram data
    const verifiedData = verifyTelegramWidgetData(widgetData);
    
    if (!verifiedData) {
      return res.status(401).json({ error: 'Invalid Telegram authentication' });
    }

    // Find or create user
    const userId = await findOrCreateTelegramUser(verifiedData);
    
    if (!userId) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Generate tokens
    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);

    // Create session
    await query(
      'INSERT INTO user_sessions (user_id, session_token, refresh_token, ip_address, user_agent, expires_at) ' +
      'VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL \'7 days\')',
      [userId, token, refreshToken, getClientIp(req), req.headers['user-agent']]
    );

    // Get user data
    const userResult = await query(
      'SELECT u.*, w.id as wallet_id, ' +
      'COALESCE(w.coins_balance, 0)::numeric as coins_balance, ' +
      'COALESCE(w.fires_balance, 0)::numeric as fires_balance, ' +
      'array_agg(r.name) as roles ' +
      'FROM users u ' +
      'LEFT JOIN wallets w ON w.user_id = u.id ' +
      'LEFT JOIN user_roles ur ON ur.user_id = u.id ' +
      'LEFT JOIN roles r ON r.id = ur.role_id ' +
      'WHERE u.id = $1 ' +
      'GROUP BY u.id, w.id, w.coins_balance, w.fires_balance',
      [userId]
    );

    const user = userResult.rows[0];

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        tg_id: user.tg_id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        wallet_id: user.wallet_id,
        coins_balance: parseFloat(user.coins_balance || 0),
        fires_balance: parseFloat(user.fires_balance || 0),
        roles: user.roles?.filter(Boolean) || []
      }
    });

  } catch (error) {
    logger.error('Telegram widget login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(refreshToken, config.security.jwtSecret);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Check if session exists
    const sessionResult = await query(
      'SELECT * FROM user_sessions WHERE refresh_token = $1 AND is_active = true',
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session not found' });
    }

    // Generate new tokens
    const newToken = generateToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    // Update session
    await query(
      'UPDATE user_sessions SET session_token = $1, refresh_token = $2, last_activity_at = NOW() ' +
      'WHERE refresh_token = $3',
      [newToken, newRefreshToken, refreshToken]
    );

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = 
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token ||
      req.headers['x-session-id'];

    if (token) {
      // Invalidate session
      await query(
        'UPDATE user_sessions SET is_active = false WHERE session_token = $1',
        [token]
      );
    }

    // Clear cookie
    res.clearCookie('token');

    res.json({ success: true, message: 'Logged out successfully' });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Helper function to find or create Telegram user
async function findOrCreateTelegramUser(telegramData) {
  try {
    return await transaction(async (client) => {
      // Check if user exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE tg_id = $1',
        [telegramData.id]
      );

      if (existingUser.rows.length > 0) {
        const userId = existingUser.rows[0].id;
        
        // Update user info
        await client.query(
          'UPDATE users SET ' +
          'username = COALESCE($2, username), ' +
          'display_name = COALESCE($3, display_name), ' +
          'avatar_url = COALESCE($4, avatar_url), ' +
          'last_seen_at = NOW() ' +
          'WHERE id = $1',
          [
            userId,
            telegramData.username,
            telegramData.first_name + (telegramData.last_name ? ' ' + telegramData.last_name : ''),
            telegramData.photo_url
          ]
        );

        return userId;
      }

      // Create new user
      const newUser = await client.query(
        'INSERT INTO users (id, tg_id, username, display_name, avatar_url, first_seen_at, last_seen_at) ' +
        'VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) ' +
        'RETURNING id',
        [
          uuidv4(),
          telegramData.id,
          telegramData.username,
          telegramData.first_name + (telegramData.last_name ? ' ' + telegramData.last_name : ''),
          telegramData.photo_url
        ]
      );

      const userId = newUser.rows[0].id;

      // Create auth identity
      await client.query(
        'INSERT INTO auth_identities (user_id, provider, provider_uid) ' +
        'VALUES ($1, $2, $3)',
        [userId, 'telegram', String(telegramData.id)]
      );

      // Create wallet with initial balance
      const initialCoins = config.features.economyDevAutoSeed ? config.features.economyDevSeedCoins : 0;
      const initialFires = config.features.economyDevAutoSeed ? config.features.economyDevSeedFires : 0;

      await client.query(
        'INSERT INTO wallets (user_id, coins_balance, fires_balance) ' +
        'VALUES ($1, $2, $3)',
        [userId, initialCoins, initialFires]
      );

      // Assign default role
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['user']
      );

      if (roleResult.rows.length > 0) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [userId, roleResult.rows[0].id]
        );
      }

      // Check if user is Tote and assign role
      if (String(telegramData.id) === config.telegram.toteId) {
        const toteRoleResult = await client.query(
          'SELECT id FROM roles WHERE name = $1',
          ['tote']
        );

        if (toteRoleResult.rows.length > 0) {
          await client.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, toteRoleResult.rows[0].id]
          );
        }
      }

      logger.info('New Telegram user created', { 
        userId, 
        tgId: telegramData.id, 
        username: telegramData.username 
      });

      // Procesar eventos de first_login para usuario nuevo de Telegram
      const giftService = require('../services/giftService');
      setImmediate(async () => {
        try {
          await giftService.processFirstLoginEvents(userId);
        } catch (error) {
          logger.error('Error processing first login events for Telegram user:', error);
        }
      });

      return userId;
    });
  } catch (error) {
    logger.error('Error creating Telegram user:', error);
    return null;
  }
}

// Change password
router.put('/change-password', async (req, res) => {
  try {
    const { current_password, new_password, new_password_confirm } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Decode token to get user_id
    const jwt = require('jsonwebtoken');
    let userId;
    try {
      const decoded = jwt.verify(token, config.security.jwtSecret);
      userId = decoded.userId; // el payload usa 'userId'
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Validaciones comunes
    if (!new_password || !new_password_confirm) {
      return res.status(400).json({ error: 'Los campos de nueva contraseña son requeridos' });
    }
    if (new_password !== new_password_confirm) {
      return res.status(400).json({ error: 'Las contraseñas nuevas no coinciden' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Obtener hash actual desde auth_identities (provider='email')
    const aiRes = await query(
      "SELECT password_hash FROM auth_identities WHERE user_id = $1 AND provider = 'email'",
      [userId]
    );
    const existingHash = aiRes.rows[0]?.password_hash || null;

    // Si YA tiene contraseña, validar current_password
    if (existingHash) {
      if (!current_password) {
        return res.status(400).json({ error: 'Contraseña actual requerida' });
      }
      const ok = await bcrypt.compare(current_password, existingHash);
      if (!ok) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }
      if (current_password === new_password) {
        return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });
      }
    }

    // Hash nueva contraseña
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Guardar SIEMPRE en auth_identities (provider='email'). Crear fila si no existe
    if (aiRes.rows.length > 0) {
      await query(
        "UPDATE auth_identities SET password_hash = $1 WHERE user_id = $2 AND provider = 'email'",
        [newPasswordHash, userId]
      );
    } else {
      // Obtener email/username para provider_uid (puede ser null si no hay email)
      const info = await query('SELECT email, username FROM users WHERE id = $1', [userId]);
      const providerUid = info.rows[0]?.email || info.rows[0]?.username || String(userId);
      await query(
        "INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at) VALUES ($1, 'email', $2, $3, NOW())",
        [userId, providerUid, newPasswordHash]
      );
    }

    logger.info(existingHash ? 'Password changed successfully' : 'Password set successfully', { userId });

    res.json({
      success: true,
      message: existingHash ? 'Contraseña actualizada correctamente' : '¡Contraseña establecida correctamente!'
    });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// POST /api/auth/reset-password-request - Solicitar reset de clave con respuesta de seguridad
router.post('/reset-password-request', async (req, res) => {
  try {
    const { method, identifier, security_answer } = req.body;
    
    // Validaciones
    if (!method || !identifier || !security_answer) {
      return res.status(400).json({ error: 'Método, identificador y respuesta de seguridad requeridos' });
    }
    
    if (method !== 'telegram' && method !== 'email') {
      return res.status(400).json({ error: 'Método debe ser "telegram" o "email"' });
    }
    
    // Validar formato de respuesta
    const validation = validateSecurityAnswer(security_answer);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Buscar usuario por método
    let userQuery;
    if (method === 'telegram') {
      userQuery = 'SELECT * FROM users WHERE tg_id = $1';
    } else {
      userQuery = 'SELECT * FROM users WHERE email = $1';
    }
    
    const userResult = await query(userQuery, [identifier]);
    
    if (userResult.rows.length === 0) {
      // No revelar si el usuario existe o no (seguridad)
      return res.status(400).json({ error: 'Datos incorrectos' });
    }
    
    const user = userResult.rows[0];
    
    // Verificar que tenga respuesta de seguridad configurada
    if (!user.security_answer) {
      return res.status(400).json({ 
        error: 'Este usuario no tiene configurada una respuesta de seguridad. Contacta al soporte.' 
      });
    }
    
    // Comparar respuesta de seguridad
    const isMatch = await compareSecurityAnswer(security_answer, user.security_answer);
    
    if (!isMatch) {
      logger.warn('Failed security answer attempt', { 
        userId: user.id, 
        username: user.username 
      });
      return res.status(400).json({ error: 'Respuesta de seguridad incorrecta' });
    }
    
    // Respuesta correcta: resetear clave a "123456"
    const defaultPasswordHash = await bcrypt.hash('123456', 10);
    
    // Actualizar en auth_identities (provider='email')
    const aiRes = await query(
      "SELECT id FROM auth_identities WHERE user_id = $1 AND provider = 'email'",
      [user.id]
    );
    
    if (aiRes.rows.length > 0) {
      await query(
        "UPDATE auth_identities SET password_hash = $1 WHERE user_id = $2 AND provider = 'email'",
        [defaultPasswordHash, user.id]
      );
    } else {
      // Crear entrada si no existe
      const providerUid = user.email || user.username || String(user.id);
      await query(
        "INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at) VALUES ($1, 'email', $2, $3, NOW())",
        [user.id, providerUid, defaultPasswordHash]
      );
    }
    
    logger.info('Password reset successful via security answer', {
      userId: user.id,
      username: user.username,
      method
    });
    
    res.json({
      success: true,
      message: 'Clave reseteada exitosamente a 123456',
      username: user.username
    });
    
  } catch (error) {
    logger.error('Reset password request error:', error);
    res.status(500).json({ error: 'Error al procesar solicitud de reset' });
  }
});

// POST /api/auth/update-security-answer - Actualizar respuesta de seguridad (requiere auth)
router.post('/update-security-answer', verifyToken, async (req, res) => {
  try {
    const { new_security_answer, current_password } = req.body;
    
    // Obtener userId del token (middleware verifyToken debe estar antes)
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (!new_security_answer || !current_password) {
      return res.status(400).json({ error: 'Respuesta de seguridad y clave actual requeridas' });
    }
    
    // Validar formato de respuesta
    const validation = validateSecurityAnswer(new_security_answer);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Verificar clave actual
    const aiRes = await query(
      "SELECT password_hash FROM auth_identities WHERE user_id = $1 AND provider = 'email'",
      [userId]
    );
    
    if (aiRes.rows.length === 0 || !aiRes.rows[0].password_hash) {
      return res.status(400).json({ error: 'No tienes clave configurada' });
    }
    
    const isPasswordValid = await bcrypt.compare(current_password, aiRes.rows[0].password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    
    // Hashear nueva respuesta de seguridad
    const hashedAnswer = await hashSecurityAnswer(new_security_answer);
    
    // Actualizar en users
    await query(
      'UPDATE users SET security_answer = $1 WHERE id = $2',
      [hashedAnswer, userId]
    );
    
    logger.info('Security answer updated', { userId });
    
    res.json({
      success: true,
      message: 'Respuesta de seguridad actualizada correctamente'
    });
    
  } catch (error) {
    logger.error('Update security answer error:', error);
    res.status(500).json({ error: 'Error al actualizar respuesta de seguridad' });
  }
});

module.exports = router;
