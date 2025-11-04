const logger = require('./logger');

/**
 * Genera código único de 6 dígitos numéricos para sala
 */
function generateRoomCode() {
  // Genera un número aleatorio entre 100000 y 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Valida si un movimiento es válido
 */
function isValidMove(board, row, col) {
  if (row < 0 || row > 2 || col < 0 || col > 2) {
    return false;
  }
  
  if (board[row][col] !== null) {
    return false;
  }
  
  return true;
}

/**
 * Verifica si hay un ganador o empate
 * @returns {object|null} { winner: 'X'|'O', line: {type, index} } o { isDraw: true } o null
 */
function checkWinner(board) {
  // Verificar filas
  for (let row = 0; row < 3; row++) {
    if (board[row][0] && 
        board[row][0] === board[row][1] && 
        board[row][1] === board[row][2]) {
      return { 
        winner: board[row][0], 
        line: { type: 'row', index: row } 
      };
    }
  }
  
  // Verificar columnas
  for (let col = 0; col < 3; col++) {
    if (board[0][col] && 
        board[0][col] === board[1][col] && 
        board[1][col] === board[2][col]) {
      return { 
        winner: board[0][col], 
        line: { type: 'col', index: col } 
      };
    }
  }
  
  // Verificar diagonal principal (\)
  if (board[0][0] && 
      board[0][0] === board[1][1] && 
      board[1][1] === board[2][2]) {
    return { 
      winner: board[0][0], 
      line: { type: 'diag', index: 0 } 
    };
  }
  
  // Verificar diagonal inversa (/)
  if (board[0][2] && 
      board[0][2] === board[1][1] && 
      board[1][1] === board[2][0]) {
    return { 
      winner: board[0][2], 
      line: { type: 'diag', index: 1 } 
    };
  }
  
  // Verificar empate (tablero lleno)
  const isFull = board.every(row => row.every(cell => cell !== null));
  if (isFull) {
    return { winner: null, isDraw: true };
  }
  
  return null; // Juego continúa
}

/**
 * Distribuye premios al finalizar partida
 */
async function distributePrizes(room, query) {
  const currency = room.mode; // 'coins' o 'fires'
  const potTotal = parseFloat(room.mode === 'coins' ? room.pot_coins : room.pot_fires);
  
  // Sin comisión - 100% al ganador o 50% c/u en empate
  if (room.winner_id) {
    // Victoria: ganador recibe 100%
    // Primero obtener balance actual (antes de actualizar)
    const walletResult = await query(
      'SELECT id, ' + (currency === 'fires' ? 'fires_balance' : 'coins_balance') + ' as balance FROM wallets WHERE user_id = $1',
      [room.winner_id]
    );
    
    if (walletResult.rows.length > 0) {
      const wallet = walletResult.rows[0];
      const balanceBefore = parseFloat(wallet.balance);
      const balanceAfter = balanceBefore + potTotal;
      
      // Actualizar balance
      await query(
        `UPDATE wallets 
         SET ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} = $1,
             ${currency === 'fires' ? 'total_fires_earned' : 'total_coins_earned'} = 
             ${currency === 'fires' ? 'total_fires_earned' : 'total_coins_earned'} + $2,
             updated_at = NOW()
         WHERE user_id = $3`,
        [balanceAfter, potTotal, room.winner_id]
      );
      
      // Registrar transacción
      await query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES ($1, 'game_win', $2, $3, $4, $5, $6, $7)`,
        [
          wallet.id,
          currency,
          potTotal,
          balanceBefore,
          balanceAfter,
          'Victoria en La Vieja',
          room.code
        ]
      );
    }
    
    // Actualizar prize en room
    await query(
      `UPDATE tictactoe_rooms 
       SET ${currency === 'fires' ? 'prize_fires' : 'prize_coins'} = $1
       WHERE id = $2`,
      [potTotal, room.id]
    );
    
    logger.info('Tictactoe prize distributed', { 
      roomId: room.id, 
      winnerId: room.winner_id, 
      amount: potTotal,
      currency 
    });
  } else if (room.is_draw) {
    // Empate: cada jugador recupera 50%
    const refund = potTotal / 2;
    
    for (const playerId of [room.player_x_id, room.player_o_id]) {
      // Primero obtener balance actual (antes de actualizar)
      const walletResult = await query(
        'SELECT id, ' + (currency === 'fires' ? 'fires_balance' : 'coins_balance') + ' as balance FROM wallets WHERE user_id = $1',
        [playerId]
      );
      
      if (walletResult.rows.length > 0) {
        const wallet = walletResult.rows[0];
        const balanceBefore = parseFloat(wallet.balance);
        const balanceAfter = balanceBefore + refund;
        
        // Actualizar balance
        await query(
          `UPDATE wallets 
           SET ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} = $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [balanceAfter, playerId]
        );
        
        // Registrar transacción
        await query(
          `INSERT INTO wallet_transactions 
           (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
           VALUES ($1, 'game_refund', $2, $3, $4, $5, $6, $7)`,
          [
            wallet.id,
            currency,
            refund,
            balanceBefore,
            balanceAfter,
            'Empate en La Vieja',
            room.code
          ]
        );
      }
    }
    
    await query(
      `UPDATE tictactoe_rooms 
       SET ${currency === 'fires' ? 'prize_fires' : 'prize_coins'} = $1
       WHERE id = $2`,
      [potTotal, room.id]
    );
    
    logger.info('Tictactoe draw refund', { 
      roomId: room.id, 
      refundEach: refund,
      currency 
    });
  }
}

/**
 * Otorga XP a ambos jugadores
 */
async function awardGameXP(room, awardXpBatch) {
  if (room.xp_awarded) return;
  
  const awards = [
    {
      userId: room.player_x_id,
      xpAmount: 1,
      gameType: 'tictactoe',
      gameId: room.id,
      gameCode: room.code,
      metadata: { 
        won: room.winner_id === room.player_x_id,
        symbol: 'X',
        isDraw: room.is_draw,
        rematchCount: room.rematch_count
      }
    },
    {
      userId: room.player_o_id,
      xpAmount: 1,
      gameType: 'tictactoe',
      gameId: room.id,
      gameCode: room.code,
      metadata: { 
        won: room.winner_id === room.player_o_id,
        symbol: 'O',
        isDraw: room.is_draw,
        rematchCount: room.rematch_count
      }
    }
  ];
  
  const results = await awardXpBatch(awards);
  
  logger.info('Tictactoe XP awarded', { 
    roomId: room.id, 
    results 
  });
  
  return results;
}

/**
 * Devuelve la apuesta de un jugador
 * @param {object} client - Cliente de transacción PostgreSQL
 * @param {string} userId - ID del usuario
 * @param {string} mode - 'coins' o 'fires'
 * @param {number} amount - Cantidad a devolver
 * @param {string} roomCode - Código de la sala
 * @param {string} reason - Razón de la devolución
 */
async function refundBet(client, userId, mode, amount, roomCode, reason) {
  const column = mode === 'fires' ? 'fires_balance' : 'coins_balance';
  const spentColumn = mode === 'fires' ? 'total_fires_spent' : 'total_coins_spent';
  
  // Obtener balance actual
  const walletResult = await client.query(
    `SELECT ${column} FROM wallets WHERE user_id = $1`,
    [userId]
  );
  
  if (walletResult.rows.length === 0) {
    throw new Error(`Wallet not found for user ${userId}`);
  }
  
  const currentBalance = parseFloat(walletResult.rows[0][column]);
  const newBalance = currentBalance + amount;
  
  // Actualizar balance
  await client.query(
    `UPDATE wallets 
     SET ${column} = $1,
         ${spentColumn} = ${spentColumn} - $2,
         updated_at = NOW()
     WHERE user_id = $3`,
    [newBalance, amount, userId]
  );
  
  // Registrar transacción
  await client.query(
    `INSERT INTO wallet_transactions 
     (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
     VALUES (
       (SELECT id FROM wallets WHERE user_id = $1),
       'refund', $2, $3, $4, $5, $6, $7
     )`,
    [userId, mode, amount, currentBalance, newBalance, reason, roomCode]
  );
  
  logger.info('Bet refunded', { userId, mode, amount, roomCode, reason });
  
  return newBalance;
}

/**
 * Cancela una sala y devuelve las apuestas
 * @param {object} client - Cliente de transacción PostgreSQL
 * @param {object} room - Objeto de la sala
 * @param {string} reason - Razón de cancelación
 */
async function cancelRoomAndRefund(client, room, reason) {
  const betAmount = parseFloat(room.bet_amount);
  const mode = room.mode;
  
  // Devolver apuesta al host (player_x)
  if (room.player_x_id) {
    await refundBet(
      client,
      room.player_x_id,
      mode,
      betAmount,
      room.code,
      `Sala cancelada: ${reason}`
    );
  }
  
  // Devolver apuesta al invitado (player_o) si existe
  if (room.player_o_id) {
    await refundBet(
      client,
      room.player_o_id,
      mode,
      betAmount,
      room.code,
      `Sala cancelada: ${reason}`
    );
  }
  
  // Marcar sala como cancelada
  await client.query(
    `UPDATE tictactoe_rooms 
     SET status = 'cancelled',
         finished_at = NOW()
     WHERE id = $1`,
    [room.id]
  );
  
  logger.info('Room cancelled and refunded', {
    roomId: room.id,
    roomCode: room.code,
    reason,
    playersRefunded: [room.player_x_id, room.player_o_id].filter(Boolean)
  });
  
  return true;
}

/**
 * Transfiere el rol de host al invitado
 * @param {object} client - Cliente de transacción PostgreSQL
 * @param {object} room - Objeto de la sala
 */
async function transferHost(client, room) {
  if (!room.player_o_id) {
    throw new Error('No hay invitado para transferir host');
  }
  
  // Obtener datos del invitado
  const userResult = await client.query(
    'SELECT username, display_name FROM users WHERE id = $1',
    [room.player_o_id]
  );
  
  if (userResult.rows.length === 0) {
    throw new Error('Invitado no encontrado');
  }
  
  const newHost = userResult.rows[0];
  
  // Transferir host: player_o se convierte en player_x
  await client.query(
    `UPDATE tictactoe_rooms 
     SET host_id = $1,
         player_x_id = $2,
         player_x_ready = $3,
         player_o_id = NULL,
         player_o_ready = FALSE,
         status = 'waiting'
     WHERE id = $4`,
    [room.player_o_id, room.player_o_id, room.player_o_ready, room.id]
  );
  
  logger.info('Host transferred', {
    roomId: room.id,
    roomCode: room.code,
    oldHost: room.player_x_id,
    newHost: room.player_o_id,
    newHostUsername: newHost.username
  });
  
  return {
    newHostId: room.player_o_id,
    newHostUsername: newHost.username
  };
}

module.exports = {
  generateRoomCode,
  isValidMove,
  checkWinner,
  distributePrizes,
  awardGameXP,
  refundBet,
  cancelRoomAndRefund,
  transferHost
};
