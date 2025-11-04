const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get current active welcome event
router.get('/current', optionalAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, message, coins_amount, fires_amount, duration_hours, 
              starts_at, ends_at, max_claims
       FROM welcome_events 
       WHERE is_active = true 
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at > NOW())
       ORDER BY priority DESC, created_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({ active: false });
    }

    const event = result.rows[0];

    // Check if user has already claimed
    let claimed = false;
    if (req.user) {
      const claimResult = await query(
        'SELECT 1 FROM welcome_event_claims WHERE event_id = $1 AND user_id = $2',
        [event.id, req.user.id]
      );
      claimed = claimResult.rows.length > 0;
    }

    res.json({
      active: true,
      event: {
        id: event.id,
        name: event.name,
        message: event.message,
        coins_amount: parseFloat(event.coins_amount),
        fires_amount: parseFloat(event.fires_amount),
        duration_hours: event.duration_hours,
        expires_at: event.ends_at,
        claimed
      }
    });

  } catch (error) {
    logger.error('Error fetching current welcome event:', error);
    res.status(500).json({ error: 'Failed to fetch welcome event' });
  }
});

// Accept/claim welcome bonus
router.post('/accept', verifyToken, async (req, res) => {
  try {
    const { event_id } = req.body;
    const userId = req.user.id;

    const result = await transaction(async (client) => {
      // Get the event (with lock)
      let eventQuery = `SELECT * FROM welcome_events WHERE is_active = true`;
      const params = [];
      
      if (event_id) {
        eventQuery += ` AND id = $1`;
        params.push(event_id);
      } else {
        eventQuery += ` AND (starts_at IS NULL OR starts_at <= NOW()) 
                        AND (ends_at IS NULL OR ends_at > NOW())
                        ORDER BY priority DESC, created_at DESC LIMIT 1`;
      }
      
      eventQuery += ' FOR UPDATE';
      
      const eventResult = await client.query(eventQuery, params);

      if (eventResult.rows.length === 0) {
        throw new Error('No active welcome event found');
      }

      const event = eventResult.rows[0];

      // Check if already claimed
      const claimCheck = await client.query(
        'SELECT 1 FROM welcome_event_claims WHERE event_id = $1 AND user_id = $2',
        [event.id, userId]
      );

      if (claimCheck.rows.length > 0) {
        throw new Error('Welcome bonus already claimed');
      }

      // Check max claims
      if (event.max_claims) {
        const claimsCount = await client.query(
          'SELECT COUNT(*) as count FROM welcome_event_claims WHERE event_id = $1',
          [event.id]
        );

        if (parseInt(claimsCount.rows[0].count) >= event.max_claims) {
          throw new Error('Maximum claims reached for this event');
        }
      }

      // Get user wallet (with lock)
      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      const wallet = walletResult.rows[0];
      const oldCoinsBalance = parseFloat(wallet.coins_balance);
      const oldFiresBalance = parseFloat(wallet.fires_balance);
      const coinsAmount = parseFloat(event.coins_amount);
      const firesAmount = parseFloat(event.fires_amount);

      // Update wallet
      if (coinsAmount > 0 || firesAmount > 0) {
        await client.query(
          `UPDATE wallets 
           SET coins_balance = coins_balance + $1,
               fires_balance = fires_balance + $2,
               total_coins_earned = total_coins_earned + $1,
               total_fires_earned = total_fires_earned + $2,
               updated_at = NOW()
           WHERE user_id = $3`,
          [coinsAmount, firesAmount, userId]
        );
      }

      // Update fire supply if fires were granted
      if (firesAmount > 0) {
        await client.query(
          'UPDATE fire_supply SET total_emitted = total_emitted + $1 WHERE id = 1',
          [firesAmount]
        );

        // Record supply transaction
        await client.query(
          `INSERT INTO supply_txs 
           (type, currency, amount, user_id, event_id, description, ip_address)
           VALUES ('welcome_bonus', 'fires', $1, $2, $3, $4, $5)`,
          [firesAmount, userId, event.id, 'Welcome event: ' + event.name, req.ip]
        );
      }

      // Record wallet transactions
      if (coinsAmount > 0) {
        await client.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, type, currency, amount, balance_before, balance_after, description)
           VALUES ($1, 'welcome_bonus', 'coins', $2, $3, $4, $5)`,
          [wallet.id, coinsAmount, oldCoinsBalance, oldCoinsBalance + coinsAmount, 
           'Welcome bonus: ' + event.name]
        );
      }

      if (firesAmount > 0) {
        await client.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, type, currency, amount, balance_before, balance_after, description)
           VALUES ($1, 'welcome_bonus', 'fires', $2, $3, $4, $5)`,
          [wallet.id, firesAmount, oldFiresBalance, oldFiresBalance + firesAmount, 
           'Welcome bonus: ' + event.name]
        );
      }

      // Record claim
      await client.query(
        `INSERT INTO welcome_event_claims 
         (event_id, user_id, user_ext, coins_claimed, fires_claimed, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.id, userId, `db:${userId}`, coinsAmount, firesAmount, req.ip]
      );

      // Record in event history
      await client.query(
        `INSERT INTO welcome_event_history (event_id, action, actor_id, payload)
         VALUES ($1, 'claimed', $2, $3)`,
        [event.id, userId, JSON.stringify({
          coins_claimed: coinsAmount,
          fires_claimed: firesAmount
        })]
      );

      return {
        success: true,
        event_name: event.name,
        coins_received: coinsAmount,
        fires_received: firesAmount,
        new_coins_balance: oldCoinsBalance + coinsAmount,
        new_fires_balance: oldFiresBalance + firesAmount
      };
    });

    logger.info('Welcome bonus claimed', { 
      userId, 
      event_id,
      coins: result.coins_received,
      fires: result.fires_received
    });

    res.json(result);

  } catch (error) {
    logger.error('Error claiming welcome bonus:', error);
    res.status(400).json({ error: error.message || 'Failed to claim welcome bonus' });
  }
});

// Get welcome status for user
router.get('/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all claimed events
    const claimedResult = await query(
      `SELECT 
        we.id,
        we.name,
        wec.coins_claimed,
        wec.fires_claimed,
        wec.claimed_at
       FROM welcome_event_claims wec
       JOIN welcome_events we ON we.id = wec.event_id
       WHERE wec.user_id = $1
       ORDER BY wec.claimed_at DESC`,
      [userId]
    );

    // Get current active event
    const activeResult = await query(
      `SELECT id, name, message, coins_amount, fires_amount
       FROM welcome_events 
       WHERE is_active = true 
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at > NOW())
       ORDER BY priority DESC, created_at DESC
       LIMIT 1`
    );

    const hasActive = activeResult.rows.length > 0;
    let canClaim = false;

    if (hasActive) {
      const activeEventId = activeResult.rows[0].id;
      const alreadyClaimed = claimedResult.rows.some(claim => claim.id === activeEventId);
      canClaim = !alreadyClaimed;
    }

    res.json({
      claimed_events: claimedResult.rows,
      total_coins_claimed: claimedResult.rows.reduce((sum, claim) => 
        sum + parseFloat(claim.coins_claimed), 0),
      total_fires_claimed: claimedResult.rows.reduce((sum, claim) => 
        sum + parseFloat(claim.fires_claimed), 0),
      has_active_event: hasActive,
      can_claim: canClaim,
      active_event: hasActive ? activeResult.rows[0] : null
    });

  } catch (error) {
    logger.error('Error fetching welcome status:', error);
    res.status(500).json({ error: 'Failed to fetch welcome status' });
  }
});

module.exports = router;
