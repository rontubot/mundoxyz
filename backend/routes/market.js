const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config/config');
const telegramService = require('../services/telegramService');

// Request to redeem 100 fires for fiat
router.post('/redeem-100-fire', verifyToken, async (req, res) => {
  try {
    const { cedula, telefono, bank_code, bank_name, bank_account } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!cedula || !telefono) {
      return res.status(400).json({ error: 'Cedula and telefono are required' });
    }
    
    const result = await transaction(async (client) => {
      // Get wallet with lock
      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      
      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }
      
      const wallet = walletResult.rows[0];
      const firesBalance = parseFloat(wallet.fires_balance);
      
      // Check balance
      if (firesBalance < 100) {
        throw new Error('Insufficient fires balance. You need at least 100 fires');
      }
      
      // Check for pending redemptions
      const pendingCheck = await client.query(
        'SELECT COUNT(*) as count FROM market_redeems WHERE user_id = $1 AND status = \'pending\'',
        [userId]
      );
      
      if (parseInt(pendingCheck.rows[0].count) > 0) {
        throw new Error('You already have a pending redemption request');
      }
      
      // Deduct fires from wallet
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance - 100,
             total_fires_spent = total_fires_spent + 100
         WHERE user_id = $1`,
        [userId]
      );
      
      // Create redemption request
      const redeemResult = await client.query(
        `INSERT INTO market_redeems 
         (user_id, fires_amount, cedula, phone, bank_code, bank_name, bank_account, status)
         VALUES ($1, 100, $2, $3, $4, $5, $6, 'pending')
         RETURNING id`,
        [userId, cedula, telefono, bank_code, bank_name, bank_account]
      );
      
      // Record wallet transaction
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'market_redeem', 'fires', 100, $2, $3, 
           'Market redemption request', $4
         )`,
        [userId, firesBalance, firesBalance - 100, redeemResult.rows[0].id]
      );
      
      // Update fire supply (burn)
      await client.query(
        'UPDATE fire_supply SET total_burned = total_burned + 100 WHERE id = 1'
      );
      
      // Record supply transaction
      await client.query(
        `INSERT INTO supply_txs 
         (type, currency, amount, user_id, description, ip_address)
         VALUES ('burn_market_redeem', 'fires', 100, $1, 'Market redemption', $2)`,
        [userId, req.ip]
      );
      
      return {
        success: true,
        redemption_id: redeemResult.rows[0].id,
        redemption: redeemResult.rows[0],
        message: 'Redemption request created. Waiting for Tote approval.'
      };
    });
    
    // Get user details for notification
    const userDetails = await query(
      'SELECT username, email FROM users WHERE id = $1',
      [userId]
    );
    
    // Send notification to Tote via Telegram
    try {
      await telegramService.notifyRedemptionRequest({
        redemption_id: result.redemption_id,
        username: userDetails.rows[0].username,
        email: userDetails.rows[0].email,
        fires_amount: 100,
        cedula,
        phone: telefono,
        bank_code,
        bank_name,
        bank_account
      });
    } catch (notifyError) {
      logger.error('Error sending Telegram notification:', notifyError);
      // No fallar la solicitud si falla la notificación
    }
    
    logger.info('Market redemption requested', { 
      userId, 
      redemptionId: result.redemption_id 
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error creating redemption request:', error);
    res.status(400).json({ error: error.message || 'Failed to create redemption request' });
  }
});

// Get pending redemptions (tote/admin)
router.get('/redeems/pending', adminAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        mr.*,
        u.username,
        u.display_name,
        u.tg_id,
        u.email,
        w.fires_balance as current_fires_balance
       FROM market_redeems mr
       JOIN users u ON u.id = mr.user_id
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE mr.status = 'pending'
       ORDER BY mr.created_at ASC`
    );
    
    res.json(result.rows);
    
  } catch (error) {
    logger.error('Error fetching pending redemptions:', error);
    res.status(500).json({ error: 'Failed to fetch pending redemptions' });
  }
});

// List all redemptions (tote/admin)
router.get('/redeems/list', adminAuth, async (req, res) => {
  try {
    const { status, user_id, limit = 50, offset = 0 } = req.query;
    
    let queryStr = `
      SELECT 
        mr.*,
        u.username,
        u.display_name,
        u.tg_id,
        processor.username as processor_username
       FROM market_redeems mr
       JOIN users u ON u.id = mr.user_id
       LEFT JOIN users processor ON processor.id = mr.processor_id
       WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (status) {
      queryStr += ` AND mr.status = $${++paramCount}`;
      params.push(status);
    }
    
    if (user_id) {
      queryStr += ` AND mr.user_id = $${++paramCount}`;
      params.push(user_id);
    }
    
    queryStr += ` ORDER BY mr.created_at DESC`;
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await query(queryStr, params);
    
    res.json({
      redemptions: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    logger.error('Error listing redemptions:', error);
    res.status(500).json({ error: 'Failed to list redemptions' });
  }
});

// Accept redemption (tote/admin)
router.post('/redeems/:id/accept', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_id, proof_url, notes } = req.body;
    
    const result = await transaction(async (client) => {
      // Get redemption
      const redeemResult = await client.query(
        'SELECT * FROM market_redeems WHERE id = $1 FOR UPDATE',
        [id]
      );
      
      if (redeemResult.rows.length === 0) {
        throw new Error('Redemption not found');
      }
      
      const redeem = redeemResult.rows[0];
      
      if (redeem.status !== 'pending') {
        throw new Error('Redemption is not pending');
      }
      
      // Update redemption
      await client.query(
        `UPDATE market_redeems 
         SET status = 'completed',
             transaction_id = $1,
             proof_url = $2,
             processor_notes = $3,
             processor_id = $4,
             processed_at = NOW()
         WHERE id = $5`,
        [transaction_id, proof_url, notes, req.user?.id || null, id]
      );
      
      return {
        success: true,
        message: 'Redemption accepted and marked as completed',
        redeem
      };
    });
    
    // Get user details for notification
    const userDetails = await query(
      'SELECT username FROM users WHERE id = $1',
      [result.redeem.user_id]
    );
    
    // Send notification to admin via Telegram
    try {
      await telegramService.notifyRedemptionCompleted({
        username: userDetails.rows[0].username,
        fires_amount: result.redeem.fires_amount,
        transaction_id
      });
    } catch (notifyError) {
      logger.error('Error sending Telegram notification:', notifyError);
    }
    
    logger.info('Market redemption accepted', { 
      redemptionId: id, 
      processor: req.user?.username 
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error accepting redemption:', error);
    res.status(400).json({ error: error.message || 'Failed to accept redemption' });
  }
});

// Reject redemption (tote/admin)
router.post('/redeems/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    const result = await transaction(async (client) => {
      // Get redemption
      const redeemResult = await client.query(
        'SELECT * FROM market_redeems WHERE id = $1 FOR UPDATE',
        [id]
      );
      
      if (redeemResult.rows.length === 0) {
        throw new Error('Redemption not found');
      }
      
      const redeem = redeemResult.rows[0];
      
      if (redeem.status !== 'pending') {
        throw new Error('Redemption is not pending');
      }
      
      // Return fires to user
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance + $1,
             total_fires_spent = total_fires_spent - $1
         WHERE user_id = $2`,
        [redeem.fires_amount, redeem.user_id]
      );
      
      // Update redemption
      await client.query(
        `UPDATE market_redeems 
         SET status = 'rejected',
             processor_notes = $1,
             processor_id = $2,
             processed_at = NOW()
         WHERE id = $3`,
        [reason, req.user?.id || null, id]
      );
      
      // Reverse the burn in supply
      await client.query(
        'UPDATE fire_supply SET total_burned = total_burned - $1 WHERE id = 1',
        [redeem.fires_amount]
      );
      
      // Record reversal in supply transactions
      await client.query(
        `INSERT INTO supply_txs 
         (type, currency, amount, user_id, description, actor_id)
         VALUES ('reversal_market_redeem', 'fires', $1, $2, $3, $4)`,
        [redeem.fires_amount, redeem.user_id, 
         'Redemption rejected: ' + reason, req.user?.id || null]
      );
      
      // Record wallet transaction
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'market_redeem_reversal', 'fires', $2, 
           (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
           (SELECT fires_balance FROM wallets WHERE user_id = $1),
           $3, $4
         )`,
        [redeem.user_id, redeem.fires_amount, 
         'Redemption rejected: ' + reason, id]
      );
      
      return {
        success: true,
        message: 'Redemption rejected and fires returned to user',
        redeem
      };
    });
    
    // Get user details for notification
    const userDetails = await query(
      'SELECT username FROM users WHERE id = $1',
      [result.redeem.user_id]
    );
    
    // Send notification to admin via Telegram
    try {
      await telegramService.notifyRedemptionRejected({
        username: userDetails.rows[0].username,
        fires_amount: result.redeem.fires_amount,
        reason
      });
    } catch (notifyError) {
      logger.error('Error sending Telegram notification:', notifyError);
    }
    
    logger.info('Market redemption rejected', { 
      redemptionId: id, 
      processor: req.user?.username,
      reason 
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error rejecting redemption:', error);
    res.status(400).json({ error: error.message || 'Failed to reject redemption' });
  }
});

// Get user's redemption history
router.get('/my-redeems', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT 
        mr.*,
        processor.username as processor_username
       FROM market_redeems mr
       LEFT JOIN users processor ON processor.id = mr.processor_id
       WHERE mr.user_id = $1
       ORDER BY mr.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    logger.error('Error fetching user redemptions:', error);
    res.status(500).json({ error: 'Failed to fetch redemption history' });
  }
});

// Get market statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
        COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
        COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected,
        SUM(fires_amount) FILTER (WHERE status = 'completed') as total_fires_redeemed,
        AVG(fires_amount) FILTER (WHERE status = 'completed') as avg_redemption_amount,
        COUNT(DISTINCT user_id) as unique_users
       FROM market_redeems`
    );
    
    res.json(stats.rows[0]);
    
  } catch (error) {
    logger.error('Error fetching market stats:', error);
    res.status(500).json({ error: 'Failed to fetch market statistics' });
  }
});

module.exports = router;
