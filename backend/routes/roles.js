const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get my roles
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.name, r.description, ur.granted_at, u.username as granted_by
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       LEFT JOIN users u ON u.id = ur.granted_by
       WHERE ur.user_id = $1`,
      [req.user.id]
    );

    res.json({
      user_id: req.user.id,
      username: req.user.username,
      roles: result.rows
    });

  } catch (error) {
    logger.error('Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Get all roles
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, description, created_at FROM roles ORDER BY id'
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching all roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Grant role to user
router.post('/grant', requireAdmin, async (req, res) => {
  try {
    const { user_id, role } = req.body;

    if (!user_id || !role) {
      return res.status(400).json({ error: 'user_id and role are required' });
    }

    const result = await transaction(async (client) => {
      // Get role ID
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [role]
      );

      if (roleResult.rows.length === 0) {
        throw new Error(`Role '${role}' not found`);
      }

      const roleId = roleResult.rows[0].id;

      // Check if user exists
      const userResult = await client.query(
        'SELECT id FROM users WHERE id = $1 OR tg_id = $1::bigint OR username = $1',
        [user_id]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userId = userResult.rows[0].id;

      // Grant role
      await client.query(
        'INSERT INTO user_roles (user_id, role_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, roleId, req.user.id]
      );

      return { 
        success: true, 
        user_id: userId,
        role,
        granted_by: req.user.username
      };
    });

    logger.info('Role granted', { 
      user_id, 
      role, 
      granted_by: req.user.id 
    });

    res.json(result);

  } catch (error) {
    logger.error('Error granting role:', error);
    res.status(400).json({ error: error.message || 'Failed to grant role' });
  }
});

// Revoke role from user
router.post('/revoke', requireAdmin, async (req, res) => {
  try {
    const { user_id, role } = req.body;

    if (!user_id || !role) {
      return res.status(400).json({ error: 'user_id and role are required' });
    }

    const result = await transaction(async (client) => {
      // Get role ID
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [role]
      );

      if (roleResult.rows.length === 0) {
        throw new Error(`Role '${role}' not found`);
      }

      const roleId = roleResult.rows[0].id;

      // Check if user exists
      const userResult = await client.query(
        'SELECT id FROM users WHERE id = $1 OR tg_id = $1::bigint OR username = $1',
        [user_id]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userId = userResult.rows[0].id;

      // Prevent revoking tote role from the tote user
      if (role === 'tote' && userResult.rows[0].tg_id === config.telegram.toteId) {
        throw new Error('Cannot revoke tote role from the main tote user');
      }

      // Revoke role
      const deleteResult = await client.query(
        'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
        [userId, roleId]
      );

      if (deleteResult.rowCount === 0) {
        throw new Error('User does not have this role');
      }

      return { 
        success: true, 
        user_id: userId,
        role,
        revoked_by: req.user.username
      };
    });

    logger.info('Role revoked', { 
      user_id, 
      role, 
      revoked_by: req.user.id 
    });

    res.json(result);

  } catch (error) {
    logger.error('Error revoking role:', error);
    res.status(400).json({ error: error.message || 'Failed to revoke role' });
  }
});

// Get users with specific role
router.get('/:role/users', requireAdmin, async (req, res) => {
  try {
    const { role } = req.params;

    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.tg_id, u.email, 
              ur.granted_at, grantor.username as granted_by
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       LEFT JOIN users grantor ON grantor.id = ur.granted_by
       WHERE r.name = $1
       ORDER BY ur.granted_at DESC`,
      [role]
    );

    res.json({
      role,
      users: result.rows
    });

  } catch (error) {
    logger.error('Error fetching users with role:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
