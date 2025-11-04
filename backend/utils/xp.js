/**
 * Sistema de XP - Implementación completa con base de datos
 */

const logger = require('./logger');
const { query } = require('../db');

/**
 * Otorga XP a múltiples usuarios y actualiza estadísticas
 * @param {Array} awards - Array de objetos con userId, xpAmount, gameType, metadata { won, isDraw }
 * @returns {Promise<Array>} - Resultados de las actualizaciones
 */
async function awardXpBatch(awards) {
  try {
    const results = [];
    
    for (const award of awards) {
      const { userId, xpAmount, gameType, gameCode, metadata } = award;
      
      // Determinar bonus de XP por victoria
      const wonBonus = metadata?.won && !metadata?.isDraw ? 1 : 0;
      const totalXP = xpAmount + wonBonus;
      
      // Actualizar experiencia y estadísticas en la tabla users
      const result = await query(
        `UPDATE users 
         SET experience = experience + $1,
             total_games_played = total_games_played + 1,
             total_games_won = total_games_won + $2
         WHERE id = $3
         RETURNING id, experience, total_games_played, total_games_won`,
        [totalXP, wonBonus, userId]
      );
      
      if (result.rows.length > 0) {
        const updated = result.rows[0];
        logger.info('XP and stats awarded', {
          userId,
          xpAwarded: totalXP,
          wonBonus,
          gameType,
          gameCode,
          newExperience: updated.experience,
          totalGames: updated.total_games_played,
          totalWins: updated.total_games_won,
          metadata
        });
        
        results.push({
          userId,
          success: true,
          xpAwarded: totalXP,
          newExperience: updated.experience,
          totalGames: updated.total_games_played,
          totalWins: updated.total_games_won
        });
      } else {
        logger.warn('User not found for XP award', { userId });
        results.push({
          userId,
          success: false,
          error: 'User not found'
        });
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error awarding XP batch:', error);
    throw error;
  }
}

/**
 * Obtiene el XP total de un usuario
 * @param {string} userId 
 * @returns {Promise<number>}
 */
async function getUserXP(userId) {
  // TODO: Implementar query a base de datos
  return 0;
}

/**
 * Obtiene el nivel basado en XP
 * @param {number} xp 
 * @returns {number}
 */
function getLevelFromXP(xp) {
  // Sistema simple: 10 XP por nivel
  return Math.floor(xp / 10) + 1;
}

module.exports = {
  awardXpBatch,
  getUserXP,
  getLevelFromXP
};
