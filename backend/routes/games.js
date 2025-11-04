const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get available games
router.get('/list', optionalAuth, async (req, res) => {
  try {
    const games = [
      {
        id: 'tictactoe',
        name: 'La Vieja',
        description: 'Duelos rápidos de 3 en raya - 15 seg por turno',
        icon: '❌⭕',
        modes: ['coins', 'fires'],
        min_players: 2,
        max_players: 2,
        status: 'available',
        features: ['timer', 'rematch', 'no_commission']
      },
      {
        id: 'bingo',
        name: 'Bingo',
        description: 'Bingo con 75 o 90 bolas',
        icon: '🎱',
        modes: ['friendly', 'coins', 'fires'],
        min_players: 2,
        max_players: 20,
        status: 'available'
      },
      {
        id: 'raffles',
        name: 'Rifas',
        description: 'Participa en rifas con premios',
        icon: '🎯',
        modes: ['free', 'coins', 'fires'],
        min_players: 1,
        max_players: 1000,
        status: 'available'
      }
    ];

    // Get active rooms count for each game (with error handling)
    try {
      const tictactoeCount = await query(
        "SELECT COUNT(*) as count FROM tictactoe_rooms WHERE status IN ('waiting', 'ready', 'playing')"
      );
      games[0].active_rooms = parseInt(tictactoeCount.rows[0].count);
    } catch (err) {
      logger.warn('Tictactoe table not found:', err.message);
      games[0].active_rooms = 0;
    }
    
    try {
      const bingoCount = await query(
        "SELECT COUNT(*) as count FROM bingo_v2_rooms WHERE status IN ('waiting', 'in_progress')"
      );
      games[1].active_rooms = parseInt(bingoCount.rows[0].count);
    } catch (err) {
      logger.error('Error fetching bingo rooms:', err);
      games[1].active_rooms = 0;
    }
    
    try {
      const raffleCount = await query(
        "SELECT COUNT(*) as count FROM raffles WHERE status IN ('pending', 'active')"
      );
      games[2].active_rooms = parseInt(raffleCount.rows[0].count);
    } catch (err) {
      logger.warn('Raffles table not found:', err.message);
      games[2].active_rooms = 0;
    }

    res.json(games);

  } catch (error) {
    logger.error('Error fetching games list:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get user's game history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { game_type, limit = 20, offset = 0 } = req.query;

    let history = [];

    // Get bingo history
    if (!game_type || game_type === 'bingo') {
      const bingoResult = await query(
        `SELECT 
          'bingo' as game_type,
          br.id,
          br.code,
          br.name,
          br.mode,
          br.status,
          br.created_at,
          br.finished_at as ends_at,
          bp.cards_purchased as cards_count,
          bp.total_spent as fires_spent,
          bp.total_spent as coins_spent,
          CASE WHEN br.winner_id = $1 THEN true ELSE false END as is_winner,
          CASE WHEN br.winner_id = $1 THEN true ELSE false END as won
        FROM bingo_v2_room_players bp
        JOIN bingo_v2_rooms br ON br.id = bp.room_id
        WHERE bp.user_id = $1 AND br.status = 'finished'
        ORDER BY br.finished_at DESC
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      history = history.concat(bingoResult.rows);
    }

    // Get raffle history
    if (!game_type || game_type === 'raffles') {
      const raffleResult = await query(
        `SELECT 
          'raffle' as game_type,
          r.id,
          r.code,
          r.name,
          r.mode,
          r.status,
          r.created_at,
          r.ends_at,
          rp.numbers,
          rp.fires_spent,
          rp.coins_spent,
          CASE WHEN r.winner_id = $1 THEN true ELSE false END as won
        FROM raffle_participants rp
        JOIN raffles r ON r.id = rp.raffle_id
        WHERE rp.user_id = $1 AND r.status = 'finished'
        ORDER BY r.ends_at DESC
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      history = history.concat(raffleResult.rows);
    }

    // Sort by date
    history.sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at));

    res.json({
      history: history.slice(0, parseInt(limit)),
      total: history.length
    });

  } catch (error) {
    logger.error('Error fetching game history:', error);
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'all', game_type, limit = 10 } = req.query;

    let dateFilter = '';
    if (period === 'today') {
      dateFilter = "AND gs.last_played_at > NOW() - INTERVAL '24 hours'";
    } else if (period === 'week') {
      dateFilter = "AND gs.last_played_at > NOW() - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND gs.last_played_at > NOW() - INTERVAL '30 days'";
    }

    let gameFilter = '';
    if (game_type) {
      gameFilter = `AND gs.game_type = '${game_type}'`;
    }

    const result = await query(
      `SELECT 
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        SUM(gs.games_won) as total_wins,
        SUM(gs.games_played) as total_played,
        SUM(gs.fires_won) as total_fires_won,
        SUM(gs.coins_won) as total_coins_won,
        ROUND((SUM(gs.games_won)::numeric / NULLIF(SUM(gs.games_played), 0)) * 100, 2) as win_rate
      FROM game_stats gs
      JOIN users u ON u.id = gs.user_id
      WHERE 1=1 ${dateFilter} ${gameFilter}
      GROUP BY u.id
      HAVING SUM(gs.games_played) > 0
      ORDER BY total_wins DESC, win_rate DESC
      LIMIT $1`,
      [limit]
    );

    res.json({
      period,
      game_type: game_type || 'all',
      leaderboard: result.rows.map((row, index) => ({
        rank: index + 1,
        ...row
      }))
    });

  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get active games (public rooms)
router.get('/active', async (req, res) => {
  try {
    const { type } = req.query;

    const games = {};

    // Get active tictactoe rooms
    if (!type || type === 'tictactoe') {
      try {
        const tictactoeResult = await query(
          `SELECT 
            r.id,
            r.code,
            r.mode,
            r.bet_amount,
            r.status,
            r.pot_coins,
            r.pot_fires,
            r.visibility,
            ux.username as player_x_username,
            uo.username as player_o_username,
            u.username as host_username
          FROM tictactoe_rooms r
          LEFT JOIN users ux ON ux.id = r.player_x_id
          LEFT JOIN users uo ON uo.id = r.player_o_id
          JOIN users u ON u.id = r.host_id
          WHERE r.status IN ('waiting', 'ready', 'playing') 
            AND r.visibility = 'public'
          ORDER BY r.created_at DESC
          LIMIT 20`
        );
        games.tictactoe = tictactoeResult.rows;
      } catch (err) {
        logger.warn('Tictactoe table not found in active games:', err.message);
        games.tictactoe = [];
      }
    }

    // Get active bingo rooms
    if (!type || type === 'bingo') {
      const bingoResult = await query(
        `SELECT 
          br.id,
          br.code,
          br.name,
          br.mode,
          br.pattern_type,
          br.status,
          br.currency_type,
          br.card_cost,
          br.total_pot,
          br.max_players,
          br.max_cards_per_player,
          COUNT(bp.id) as current_players,
          u.username as host_username
        FROM bingo_v2_rooms br
        LEFT JOIN bingo_v2_room_players bp ON bp.room_id = br.id
        JOIN users u ON u.id = br.host_id
        WHERE br.status IN ('waiting', 'in_progress') 
          AND br.is_public = true
        GROUP BY br.id, u.username
        ORDER BY br.created_at DESC
        LIMIT 20`
      );
      games.bingo = bingoResult.rows;
    }

    // Get active raffles
    if (!type || type === 'raffles') {
      const raffleResult = await query(
        `SELECT 
          r.id,
          r.code,
          r.name,
          r.mode,
          r.status,
          r.entry_price_fire,
          r.entry_price_coin,
          r.pot_fires,
          r.pot_coins,
          r.numbers_range,
          r.ends_at,
          COUNT(rp.id) as participants,
          COUNT(rn.id) as numbers_sold,
          u.username as host_username
        FROM raffles r
        LEFT JOIN raffle_participants rp ON rp.raffle_id = r.id
        LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id AND rn.state = 'sold'
        JOIN users u ON u.id = r.host_id
        WHERE r.status IN ('pending', 'active') 
          AND r.visibility = 'public'
        GROUP BY r.id, u.username
        ORDER BY r.created_at DESC
        LIMIT 20`
      );
      games.raffles = raffleResult.rows;
    }

    res.json(games);

  } catch (error) {
    logger.error('Error fetching active games:', error);
    res.status(500).json({ error: 'Failed to fetch active games' });
  }
});

module.exports = router;
