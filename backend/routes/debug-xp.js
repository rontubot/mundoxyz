/**
 * ENDPOINT TEMPORAL DE DEBUG PARA VERIFICAR DATOS DE EXPERIENCIA
 * ELIMINAR DESPUÉS DE DIAGNOSTICAR
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db');

// Debug endpoint - verificar datos de experiencia
router.get('/verify/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Verificar columnas
    const columnsCheck = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' 
        AND column_name IN ('experience', 'total_games_played', 'total_games_won')
      ORDER BY column_name
    `);

    // 2. Datos del usuario
    const userResult = await query(`
      SELECT 
        u.id,
        u.username,
        u.experience,
        u.total_games_played,
        u.total_games_won,
        w.coins_balance,
        w.fires_balance,
        u.created_at
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.username = $1
    `, [username]);

    // 3. Partidas de TicTacToe
    const tttResult = await query(`
      SELECT 
        COUNT(*) as total_partidas,
        COUNT(CASE WHEN winner_id = u.id THEN 1 END) as victorias,
        COUNT(CASE WHEN is_draw = true THEN 1 END) as empates
      FROM tictactoe_rooms tr
      JOIN users u ON u.username = $1
      WHERE (tr.player_x_id = u.id OR tr.player_o_id = u.id)
        AND tr.status = 'finished'
    `, [username]);

    // 4. Partidas de Bingo V2
    const bingoResult = await query(`
      SELECT 
        COUNT(DISTINCT br.id) as total_partidas_bingo,
        COUNT(CASE WHEN br.winner_id = u.id THEN 1 END) as victorias_bingo
      FROM bingo_v2_room_players brp
      JOIN bingo_v2_rooms br ON br.id = brp.room_id
      JOIN users u ON u.username = $1
      WHERE brp.user_id = u.id
        AND br.status = 'finished'
    `, [username]);

    // 5. Top 5 usuarios con XP
    const topUsers = await query(`
      SELECT 
        username,
        experience,
        total_games_played,
        total_games_won
      FROM users
      WHERE experience > 0 OR total_games_played > 0
      ORDER BY experience DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      debug: {
        columns_exist: columnsCheck.rows,
        user_data: userResult.rows[0] || null,
        tictactoe_history: tttResult.rows[0] || { total_partidas: 0, victorias: 0, empates: 0 },
        bingo_history: bingoResult.rows[0] || { total_partidas_bingo: 0, victorias_bingo: 0 },
        top_users_with_xp: topUsers.rows
      }
    });

  } catch (error) {
    console.error('Debug XP error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

module.exports = router;
