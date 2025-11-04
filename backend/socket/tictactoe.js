const logger = require('../utils/logger');
const { query, transaction } = require('../db');
const { cancelRoomAndRefund, transferHost } = require('../utils/tictactoe');

// Map para tracking de conexiones: roomCode -> { playerX: {userId, connected, timeout}, playerO: {...} }
const roomConnections = new Map();

// Timeout de abandono (30 segundos)
const ABANDONMENT_TIMEOUT = 30000;

/**
 * Initialize TicTacToe WebSocket handlers
 */
function initTicTacToeSocket(io, socket) {
  // Join room
  socket.on('tictactoe:join-room', async (data) => {
    const { roomCode, userId, role } = data;
    if (roomCode && userId) {
      socket.join(`tictactoe:${roomCode}`);
      
      // Verificar si es reconexión o primera conexión
      const isReconnection = await isPlayerReconnecting(roomCode, userId, role);
      
      // Registrar conexión
      await registerConnection(roomCode, userId, role);
      
      logger.info('Socket joined tictactoe room', { 
        socketId: socket.id, 
        roomCode,
        userId,
        role,
        isReconnection
      });
      
      // Notificar reconexión SOLO si realmente es una reconexión
      if (isReconnection) {
        io.to(`tictactoe:${roomCode}`).emit('room:player-reconnected', {
          roomCode,
          userId,
          role
        });
      }
    }
  });
  
  // Leave room
  socket.on('tictactoe:leave-room', (data) => {
    const { roomCode } = data;
    if (roomCode) {
      socket.leave(`tictactoe:${roomCode}`);
      logger.info('Socket left tictactoe room', { 
        socketId: socket.id, 
        roomCode 
      });
    }
  });
  
  // Player joined notification
  socket.on('tictactoe:player-joined', (data) => {
    const { roomCode, playerId, username } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:player-joined', {
      roomCode,
      playerId,
      username
    });
  });
  
  // Player ready notification
  socket.on('tictactoe:player-ready', (data) => {
    const { roomCode, playerId, symbol } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:player-ready', {
      roomCode,
      playerId,
      symbol
    });
  });
  
  // Game started notification
  socket.on('tictactoe:game-started', (data) => {
    const { roomCode } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:game-started', {
      roomCode
    });
  });
  
  // Move made notification
  socket.on('tictactoe:move-made', (data) => {
    const { roomCode, playerId, symbol, row, col, nextTurn, board } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:move-made', {
      roomCode,
      playerId,
      symbol,
      row,
      col,
      nextTurn,
      board
    });
  });
  
  // Timer tick notification (cada segundo)
  socket.on('tictactoe:timer-tick', (data) => {
    const { roomCode, timeLeft, currentTurn } = data;
    socket.to(`tictactoe:${roomCode}`).emit('room:timer-tick', {
      roomCode,
      timeLeft,
      currentTurn
    });
  });
  
  // Timeout notification
  socket.on('tictactoe:timeout', (data) => {
    const { roomCode, loserId, winnerId } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:timeout', {
      roomCode,
      loserId,
      winnerId
    });
  });
  
  // Game over notification
  socket.on('tictactoe:game-over', (data) => {
    const { roomCode, winner, isDraw, winnerId, winningLine } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:game-over', {
      roomCode,
      winner,
      isDraw,
      winnerId,
      winningLine
    });
  });
  
  // Rematch request notification
  socket.on('tictactoe:rematch-request', (data) => {
    const { roomCode, playerId } = data;
    socket.to(`tictactoe:${roomCode}`).emit('room:rematch-request', {
      roomCode,
      playerId
    });
  });
  
  // Rematch accepted notification
  socket.on('tictactoe:rematch-accepted', (data) => {
    const { roomCode, newRoomCode, rematchCount } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:rematch-accepted', {
      roomCode,
      newRoomCode,
      rematchCount
    });
  });
}

/**
 * Emit event to specific room
 */
function emitToRoom(io, roomCode, event, data) {
  io.to(`tictactoe:${roomCode}`).emit(event, data);
}

/**
 * Verificar si un jugador está reconectándose
 */
async function isPlayerReconnecting(roomCode, userId, role) {
  if (!roomConnections.has(roomCode)) {
    return false;
  }
  
  const connections = roomConnections.get(roomCode);
  const key = role === 'X' ? 'playerX' : 'playerO';
  
  // Es reconexión si ya existía una entrada para este jugador
  return connections[key]?.userId === userId && connections[key]?.connected === false;
}

/**
 * Registrar conexión de jugador
 */
async function registerConnection(roomCode, userId, role) {
  if (!roomConnections.has(roomCode)) {
    roomConnections.set(roomCode, {});
  }
  
  const connections = roomConnections.get(roomCode);
  const key = role === 'X' ? 'playerX' : 'playerO';
  
  // Cancelar timeout existente si hay uno
  if (connections[key]?.timeout) {
    clearTimeout(connections[key].timeout);
  }
  
  connections[key] = {
    userId,
    connected: true,
    timeout: null,
    lastSeen: Date.now()
  };
  
  roomConnections.set(roomCode, connections);
  
  logger.info('Player connection registered', { roomCode, userId, role });
}

/**
 * Marcar jugador como desconectado e iniciar timeout
 */
async function markDisconnected(io, roomCode, userId, role) {
  if (!roomConnections.has(roomCode)) return;
  
  const connections = roomConnections.get(roomCode);
  const key = role === 'X' ? 'playerX' : 'playerO';
  
  if (!connections[key]) return;
  
  connections[key].connected = false;
  connections[key].lastSeen = Date.now();
  
  // Iniciar timeout de 30 segundos
  const timeout = setTimeout(async () => {
    await handleAbandonedRoom(io, roomCode);
  }, ABANDONMENT_TIMEOUT);
  
  connections[key].timeout = timeout;
  
  logger.info('Player marked as disconnected, timeout started', { 
    roomCode, 
    userId, 
    role,
    timeoutMs: ABANDONMENT_TIMEOUT
  });
  
  // Notificar a otros jugadores
  io.to(`tictactoe:${roomCode}`).emit('room:player-disconnected', {
    roomCode,
    userId,
    role,
    timeoutSeconds: ABANDONMENT_TIMEOUT / 1000
  });
}

/**
 * Manejar sala abandonada después del timeout
 */
async function handleAbandonedRoom(io, roomCode) {
  try {
    // Obtener información de la sala
    const roomResult = await query(
      'SELECT * FROM tictactoe_rooms WHERE code = $1',
      [roomCode]
    );
    
    if (roomResult.rows.length === 0) {
      logger.warn('Room not found for abandonment check', { roomCode });
      roomConnections.delete(roomCode);
      return;
    }
    
    const room = roomResult.rows[0];
    
    // Solo procesar si la sala está activa
    if (!['waiting', 'ready', 'playing'].includes(room.status)) {
      roomConnections.delete(roomCode);
      return;
    }
    
    const connections = roomConnections.get(roomCode);
    if (!connections) return;
    
    const playerXConnected = connections.playerX?.connected !== false;
    const playerOConnected = connections.playerO?.connected !== false;
    const hasPlayerO = room.player_o_id !== null;
    
    logger.info('Checking abandoned room', {
      roomCode,
      status: room.status,
      playerXConnected,
      playerOConnected,
      hasPlayerO
    });
    
    // ESCENARIO 1: Ambos desconectados
    if (!playerXConnected && !playerOConnected && hasPlayerO) {
      await transaction(async (client) => {
        await cancelRoomAndRefund(client, room, 'Ambos jugadores abandonaron');
      });
      
      io.to(`tictactoe:${roomCode}`).emit('room:abandoned', {
        roomCode,
        reason: 'Ambos jugadores abandonaron',
        refunded: true
      });
      
      roomConnections.delete(roomCode);
      logger.info('Room cancelled - both players abandoned', { roomCode });
      return;
    }
    
    // ESCENARIO 2: Solo host desconectado sin invitado
    if (!playerXConnected && !hasPlayerO) {
      await transaction(async (client) => {
        await cancelRoomAndRefund(client, room, 'Host abandonó sin invitado');
      });
      
      io.to(`tictactoe:${roomCode}`).emit('room:abandoned', {
        roomCode,
        reason: 'Host abandonó',
        refunded: true
      });
      
      roomConnections.delete(roomCode);
      logger.info('Room cancelled - host abandoned without guest', { roomCode });
      return;
    }
    
    // ESCENARIO 3: Host desconectado con invitado presente
    if (!playerXConnected && playerOConnected && hasPlayerO) {
      await transaction(async (client) => {
        const result = await transferHost(client, room);
        
        // Actualizar tracking de conexiones
        const oldO = connections.playerO;
        connections.playerX = {
          userId: oldO.userId,
          connected: true,
          timeout: null,
          lastSeen: Date.now()
        };
        delete connections.playerO;
        roomConnections.set(roomCode, connections);
        
        // Notificar transferencia
        io.to(`tictactoe:${roomCode}`).emit('room:host-transferred', {
          roomCode,
          newHost: result.newHostId,
          newHostUsername: result.newHostUsername
        });
        
        logger.info('Host transferred to guest', { 
          roomCode,
          newHost: result.newHostId
        });
      });
      
      return;
    }
    
  } catch (error) {
    logger.error('Error handling abandoned room', { roomCode, error: error.message });
  }
}

/**
 * Handle disconnection
 */
async function handleDisconnect(io, socket, userId, activeRooms) {
  logger.info('TicTacToe socket disconnected', { 
    socketId: socket.id,
    userId
  });
  
  // Buscar en qué salas estaba el usuario
  for (const [roomCode, connections] of roomConnections.entries()) {
    let role = null;
    
    if (connections.playerX?.userId === userId) {
      role = 'X';
    } else if (connections.playerO?.userId === userId) {
      role = 'O';
    }
    
    if (role) {
      await markDisconnected(io, roomCode, userId, role);
    }
  }
}

/**
 * Emit event to specific room
 */
function emitToRoom(io, roomCode, event, data) {
  io.to(`tictactoe:${roomCode}`).emit(event, data);
}

module.exports = {
  initTicTacToeSocket,
  emitToRoom,
  handleDisconnect,
  registerConnection,
  markDisconnected,
  isPlayerReconnecting
};
