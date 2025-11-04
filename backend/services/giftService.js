const { query, transaction } = require('../db');
const logger = require('../utils/logger');
const telegramService = require('./telegramService');

/**
 * Servicio para manejo de regalos y eventos de bienvenida
 */
class GiftService {
  
  /**
   * Enviar regalo directo a usuario(s)
   */
  async sendDirectGift(senderId, giftData) {
    const {
      target_type,
      target_user_id,
      target_segment = {},
      message,
      coins_amount = 0,
      fires_amount = 0,
      expires_hours = 48,
      auto_send = false
    } = giftData;

    return await transaction(async (client) => {
      // Crear el regalo
      const giftResult = await client.query(
        `INSERT INTO direct_gifts 
         (sender_id, target_type, target_user_id, target_segment, message, 
          coins_amount, fires_amount, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '${expires_hours} hours', $8)
         RETURNING *`,
        [
          senderId,
          target_type,
          target_user_id,
          JSON.stringify(target_segment),
          message,
          coins_amount,
          fires_amount,
          auto_send ? 'sent' : 'pending'
        ]
      );

      const gift = giftResult.rows[0];

      // Si es envío automático, acreditar inmediatamente
      if (auto_send) {
        if (target_type === 'single' && target_user_id) {
          await this.creditGiftToUser(client, gift.id, target_user_id);
        } else {
          // Enviar a múltiples usuarios según segmento
          const targetUsers = await this.getUsersBySegment(client, target_segment, target_type);
          
          for (const user of targetUsers) {
            await this.creditGiftToUser(client, gift.id, user.id);
          }
        }
      } else {
        // Crear mensajes en bandeja para que usuarios acepten
        if (target_type === 'single' && target_user_id) {
          await this.createGiftMessage(client, gift.id, target_user_id, message, coins_amount, fires_amount);
        } else {
          const targetUsers = await this.getUsersBySegment(client, target_segment, target_type);
          
          for (const user of targetUsers) {
            await this.createGiftMessage(client, gift.id, user.id, message, coins_amount, fires_amount);
          }
        }
      }

      // Registrar analítica
      await client.query(
        `INSERT INTO gift_analytics (gift_id, action, metadata)
         VALUES ($1, 'sent', $2)`,
        [gift.id, JSON.stringify({ 
          target_type, 
          auto_send,
          coins_amount,
          fires_amount
        })]
      );

      return gift;
    });
  }

  /**
   * Obtener usuarios según segmento
   */
  async getUsersBySegment(client, segment, targetType) {
    let query_str = 'SELECT DISTINCT u.id FROM users u JOIN wallets w ON u.id = w.user_id WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (targetType === 'first_time') {
      query_str += ` AND NOT EXISTS (
        SELECT 1 FROM welcome_event_claims wec WHERE wec.user_id = u.id
      )`;
    }

    if (targetType === 'inactive' && segment.days) {
      paramCount++;
      query_str += ` AND u.last_seen_at < NOW() - INTERVAL '${segment.days} days'`;
    }

    if (targetType === 'low_balance') {
      const coinLimit = segment.coin_limit || 100;
      const fireLimit = segment.fire_limit || 10;
      query_str += ` AND (w.coins_balance < ${coinLimit} OR w.fires_balance < ${fireLimit})`;
    }

    // Nuevo: Filtro para solo usuarios existentes (registrados antes de cierta fecha)
    if (targetType === 'existing_users' && segment.registered_before) {
      paramCount++;
      params.push(segment.registered_before);
      query_str += ` AND u.created_at < $${paramCount}`;
    }

    if (segment.min_level) {
      paramCount++;
      params.push(segment.min_level);
      query_str += ` AND u.level >= $${paramCount}`;
    }

    if (segment.max_level) {
      paramCount++;
      params.push(segment.max_level);
      query_str += ` AND u.level <= $${paramCount}`;
    }

    const result = await client.query(query_str, params);
    return result.rows;
  }

  /**
   * Crear mensaje en bandeja para aceptar regalo
   */
  async createGiftMessage(client, giftId, userId, message, coinsAmount, firesAmount) {
    const messageTitle = `🎁 ¡Tienes un regalo!`;
    const messageBody = `${message}\n\n🪙 ${coinsAmount} Coins\n🔥 ${firesAmount} Fires\n\nHaz clic en "Aceptar Regalo" para recibirlo.`;

    await client.query(
      `INSERT INTO bingo_v2_messages 
       (user_id, category, title, message, metadata, is_read)
       VALUES ($1, 'system', $2, $3, $4, false)`,
      [
        userId,
        messageTitle,
        messageBody,
        JSON.stringify({
          type: 'gift_pending',
          gift_id: giftId,
          coins_amount: coinsAmount,
          fires_amount: firesAmount
        })
      ]
    );
  }

  /**
   * Acreditar regalo a usuario (automático o al aceptar)
   */
  async creditGiftToUser(client, giftId, userId, ipAddress = null) {
    // Verificar que no haya sido reclamado ya
    const claimCheck = await client.query(
      'SELECT 1 FROM direct_gift_claims WHERE gift_id = $1 AND user_id = $2',
      [giftId, userId]
    );

    if (claimCheck.rows.length > 0) {
      throw new Error('Gift already claimed by this user');
    }

    // Obtener datos del regalo
    const giftResult = await client.query(
      'SELECT * FROM direct_gifts WHERE id = $1',
      [giftId]
    );

    if (giftResult.rows.length === 0) {
      throw new Error('Gift not found');
    }

    const gift = giftResult.rows[0];

    if (gift.status === 'expired') {
      throw new Error('Gift has expired');
    }

    // Obtener wallet del usuario
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
    const coinsAmount = parseFloat(gift.coins_amount);
    const firesAmount = parseFloat(gift.fires_amount);

    // Actualizar wallet
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

    // Actualizar fire supply si hay fires
    if (firesAmount > 0) {
      await client.query(
        'UPDATE fire_supply SET total_emitted = total_emitted + $1, total_circulating = total_circulating + $1 WHERE id = 1',
        [firesAmount]
      );

      // Registrar supply transaction
      await client.query(
        `INSERT INTO supply_txs 
         (type, currency, amount, user_id, description, ip_address)
         VALUES ('direct_gift', 'fires', $1, $2, $3, $4)`,
        [firesAmount, userId, `Direct gift: ${gift.message.substring(0, 50)}...`, ipAddress]
      );
    }

    // Registrar transacciones en wallet
    if (coinsAmount > 0) {
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description)
         VALUES ($1, 'direct_gift', 'coins', $2, $3, $4, $5)`,
        [wallet.id, coinsAmount, oldCoinsBalance, oldCoinsBalance + coinsAmount, 
         `Gift: ${gift.message.substring(0, 50)}...`]
      );
    }

    if (firesAmount > 0) {
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description)
         VALUES ($1, 'direct_gift', 'fires', $2, $3, $4, $5)`,
        [wallet.id, firesAmount, oldFiresBalance, oldFiresBalance + firesAmount, 
         `Gift: ${gift.message.substring(0, 50)}...`]
      );
    }

    // Registrar claim
    await client.query(
      `INSERT INTO direct_gift_claims 
       (gift_id, user_id, coins_claimed, fires_claimed, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [giftId, userId, coinsAmount, firesAmount, ipAddress]
    );

    // Actualizar status del regalo si es single
    if (gift.target_type === 'single') {
      await client.query(
        'UPDATE direct_gifts SET status = $1, claimed_at = NOW() WHERE id = $2',
        ['claimed', giftId]
      );
    }

    // Registrar analítica
    await client.query(
      `INSERT INTO gift_analytics (gift_id, user_id, action, metadata)
       VALUES ($1, $2, 'claimed', $3)`,
      [giftId, userId, JSON.stringify({
        coins_claimed: coinsAmount,
        fires_claimed: firesAmount
      })]
    );

    return {
      success: true,
      coins_received: coinsAmount,
      fires_received: firesAmount,
      new_coins_balance: oldCoinsBalance + coinsAmount,
      new_fires_balance: oldFiresBalance + firesAmount
    };
  }

  /**
   * Obtener estadísticas de eventos
   */
  async getEventAnalytics(eventId = null) {
    let query_str = 'SELECT * FROM welcome_event_stats';
    const params = [];

    if (eventId) {
      query_str += ' WHERE id = $1';
      params.push(eventId);
    }

    query_str += ' ORDER BY created_at DESC';

    const result = await query(query_str, params);
    return result.rows;
  }

  /**
   * Obtener estadísticas de regalos directos
   */
  async getGiftAnalytics(giftId = null) {
    let query_str = 'SELECT * FROM direct_gift_stats';
    const params = [];

    if (giftId) {
      query_str += ' WHERE id = $1';
      params.push(giftId);
    }

    query_str += ' ORDER BY created_at DESC';

    const result = await query(query_str, params);
    return result.rows;
  }

  /**
   * Obtener dashboard de analíticas generales
   */
  async getDashboardAnalytics(days = 30) {
    const result = await query(
      `WITH event_stats AS (
        SELECT 
          COUNT(DISTINCT we.id) as total_events,
          COUNT(DISTINCT wec.id) as total_claims,
          COALESCE(SUM(wec.coins_claimed), 0) as total_coins_distributed,
          COALESCE(SUM(wec.fires_claimed), 0) as total_fires_distributed
        FROM welcome_events we
        LEFT JOIN welcome_event_claims wec ON we.id = wec.event_id
        WHERE we.created_at > NOW() - INTERVAL '${days} days'
      ),
      gift_stats AS (
        SELECT 
          COUNT(DISTINCT dg.id) as total_gifts,
          COUNT(DISTINCT dgc.id) as total_gift_claims,
          COALESCE(SUM(dgc.coins_claimed), 0) as total_coins_gifted,
          COALESCE(SUM(dgc.fires_claimed), 0) as total_fires_gifted
        FROM direct_gifts dg
        LEFT JOIN direct_gift_claims dgc ON dg.id = dgc.gift_id
        WHERE dg.created_at > NOW() - INTERVAL '${days} days'
      ),
      return_stats AS (
        SELECT 
          COUNT(DISTINCT ga.user_id) as users_returned,
          ROUND(AVG(game_count), 2) as avg_games_after
        FROM (
          SELECT 
            ga.user_id,
            COUNT(*) as game_count
          FROM gift_analytics ga
          WHERE ga.action = 'game_played_after'
            AND ga.created_at > NOW() - INTERVAL '${days} days'
          GROUP BY ga.user_id
        ) sub
      )
      SELECT 
        es.*,
        gs.*,
        rs.*,
        CASE 
          WHEN (es.total_claims + gs.total_gift_claims) > 0 
          THEN ROUND((rs.users_returned::numeric / (es.total_claims + gs.total_gift_claims)) * 100, 2)
          ELSE 0 
        END as return_rate
      FROM event_stats es, gift_stats gs, return_stats rs`
    );

    return result.rows[0];
  }

  /**
   * Expirar regalos antiguos (cron job)
   */
  async expireOldGifts() {
    try {
      await query('SELECT expire_old_gifts()');
      logger.info('Expired old gifts successfully');
    } catch (error) {
      logger.error('Error expiring old gifts:', error);
    }
  }

  /**
   * Registrar que un usuario jugó después de recibir un regalo
   */
  async trackUserActivity(userId, activityType = 'game_played') {
    try {
      // Buscar regalos/eventos reclamados recientemente (últimos 7 días)
      const recentClaims = await query(
        `SELECT DISTINCT event_id FROM welcome_event_claims 
         WHERE user_id = $1 AND claimed_at > NOW() - INTERVAL '7 days'
         UNION
         SELECT DISTINCT gift_id as event_id FROM direct_gift_claims 
         WHERE user_id = $1 AND claimed_at > NOW() - INTERVAL '7 days'`,
        [userId]
      );

      // Registrar actividad para cada claim
      for (const claim of recentClaims.rows) {
        await query(
          `INSERT INTO gift_analytics 
           (event_id, user_id, action, metadata)
           VALUES ($1, $2, 'game_played_after', $3)
           ON CONFLICT DO NOTHING`,
          [claim.event_id, userId, JSON.stringify({ activity_type: activityType })]
        );
      }
    } catch (error) {
      logger.error('Error tracking user activity:', error);
    }
  }

  /**
   * Procesar eventos de first_login para usuario nuevo
   */
  async processFirstLoginEvents(userId) {
    try {
      logger.info('Processing first login events', { userId });

      return await transaction(async (client) => {
        // Buscar eventos activos de tipo first_login
        const eventsResult = await client.query(
          `SELECT * FROM welcome_events 
           WHERE event_type = 'first_login'
             AND is_active = true
             AND (starts_at IS NULL OR starts_at <= NOW())
             AND (ends_at IS NULL OR ends_at > NOW())
             AND (max_claims IS NULL OR claimed_count < max_claims)
           ORDER BY priority DESC, created_at ASC`
        );

        if (eventsResult.rows.length === 0) {
          logger.info('No active first_login events found');
          return { processed: 0, events: [] };
        }

        const results = [];

        for (const event of eventsResult.rows) {
          // Verificar si usuario ya reclamó este evento
          const alreadyClaimed = await client.query(
            'SELECT 1 FROM welcome_event_claims WHERE event_id = $1 AND user_id = $2',
            [event.id, userId]
          );

          if (alreadyClaimed.rows.length > 0) {
            logger.info('User already claimed this event', { eventId: event.id, userId });
            continue;
          }

          const coinsAmount = parseFloat(event.coins_amount) || 0;
          const firesAmount = parseFloat(event.fires_amount) || 0;

          if (event.require_claim) {
            // Crear mensaje en bandeja para que usuario acepte
            await client.query(
              `INSERT INTO bingo_v2_messages 
               (user_id, category, title, message, metadata, is_read)
               VALUES ($1, 'system', $2, $3, $4, false)`,
              [
                userId,
                `🎁 ${event.name}`,
                event.message,
                JSON.stringify({
                  type: 'welcome_event',
                  event_id: event.id,
                  coins_amount: coinsAmount,
                  fires_amount: firesAmount,
                  require_claim: true
                })
              ]
            );

            logger.info('Welcome event message created', {
              eventId: event.id,
              eventName: event.name,
              userId,
              coinsAmount,
              firesAmount
            });

            results.push({
              eventId: event.id,
              eventName: event.name,
              action: 'message_created',
              requireClaim: true
            });

          } else {
            // Acreditar automáticamente sin requerir claim
            const walletResult = await client.query(
              'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
              [userId]
            );

            if (walletResult.rows.length === 0) {
              logger.warn('Wallet not found for user', { userId });
              continue;
            }

            const wallet = walletResult.rows[0];
            const oldCoinsBalance = parseFloat(wallet.coins_balance);
            const oldFiresBalance = parseFloat(wallet.fires_balance);

            // Actualizar wallet
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

            // Registrar transacciones
            if (coinsAmount > 0) {
              await client.query(
                `INSERT INTO wallet_transactions 
                 (wallet_id, type, currency, amount, balance_before, balance_after, description)
                 VALUES ($1, 'welcome_event', 'coins', $2, $3, $4, $5)`,
                [wallet.id, coinsAmount, oldCoinsBalance, oldCoinsBalance + coinsAmount, 
                 `Welcome: ${event.name}`]
              );
            }

            if (firesAmount > 0) {
              await client.query(
                `INSERT INTO wallet_transactions 
                 (wallet_id, type, currency, amount, balance_before, balance_after, description)
                 VALUES ($1, 'welcome_event', 'fires', $2, $3, $4, $5)`,
                [wallet.id, firesAmount, oldFiresBalance, oldFiresBalance + firesAmount, 
                 `Welcome: ${event.name}`]
              );

              // Actualizar fire supply
              await client.query(
                'UPDATE fire_supply SET total_emitted = total_emitted + $1, total_circulating = total_circulating + $1 WHERE id = 1',
                [firesAmount]
              );
            }

            // Registrar claim
            await client.query(
              `INSERT INTO welcome_event_claims 
               (event_id, user_id, coins_claimed, fires_claimed)
               VALUES ($1, $2, $3, $4)`,
              [event.id, userId, coinsAmount, firesAmount]
            );

            logger.info('Welcome event auto-credited', {
              eventId: event.id,
              eventName: event.name,
              userId,
              coinsAmount,
              firesAmount
            });

            results.push({
              eventId: event.id,
              eventName: event.name,
              action: 'auto_credited',
              coinsAmount,
              firesAmount,
              requireClaim: false
            });
          }
        }

        logger.info('First login events processed', { 
          userId, 
          processed: results.length,
          events: results 
        });

        return { 
          processed: results.length, 
          events: results 
        };
      });

    } catch (error) {
      logger.error('Error processing first login events:', error);
      // No lanzar error para no bloquear el login
      return { processed: 0, events: [], error: error.message };
    }
  }
}

module.exports = new GiftService();
