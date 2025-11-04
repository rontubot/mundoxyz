const BingoV2Service = require('../services/bingoV2Service');
const { query } = require('../db');
const logger = require('../utils/logger');
const telegramService = require('../services/telegramService');

// Room connections tracking
const roomConnections = new Map();
const userToRoom = new Map();

// Auto-call intervals tracking
const autoCallIntervals = new Map();

function handleBingoV2Socket(io) {
  io.on('connection', (socket) => {
    console.log('🎮 Bingo V2 socket connected:', socket.id);

    // Join room
    socket.on('bingo:join_room', async (data) => {
      try {
        const { roomCode, userId } = data;
        
        // Leave previous room if any
        const previousRoom = userToRoom.get(userId);
        if (previousRoom) {
          socket.leave(previousRoom);
        }

        // Join new room
        socket.join(roomCode);
        userToRoom.set(userId, roomCode);

        // Track connection
        if (!roomConnections.has(roomCode)) {
          roomConnections.set(roomCode, new Set());
        }
        roomConnections.get(roomCode).add(userId);

        // Update player activity
        await query(
          `UPDATE bingo_v2_room_players 
           SET is_connected = true, last_activity = NOW()
           WHERE room_id = (SELECT id FROM bingo_v2_rooms WHERE code = $1)
           AND user_id = $2`,
          [roomCode, userId]
        );

        // Get room details
        const room = await BingoV2Service.getRoomDetails(roomCode);
        
        // Notify others
        socket.to(roomCode).emit('bingo:player_joined', {
          userId,
          room
        });

        // Send room details to joiner
        socket.emit('bingo:room_state', room);

        logger.info(`User ${userId} joined room ${roomCode}`);
      } catch (error) {
        logger.error('Error joining room:', error);
        socket.emit('bingo:error', { message: error.message });
      }
    });

    // Leave room
    socket.on('bingo:leave_room', async (data) => {
      try {
        const { roomCode, userId } = data;
        
        socket.leave(roomCode);
        userToRoom.delete(userId);
        
        if (roomConnections.has(roomCode)) {
          roomConnections.get(roomCode).delete(userId);
        }

        // Update player connection status
        await query(
          `UPDATE bingo_v2_room_players 
           SET is_connected = false, left_at = NOW()
           WHERE room_id = (SELECT id FROM bingo_v2_rooms WHERE code = $1)
           AND user_id = $2`,
          [roomCode, userId]
        );

        // Notify others
        socket.to(roomCode).emit('bingo:player_left', { userId });

        // Check if room is empty for auto-cancel
        const activePlayersResult = await query(
          `SELECT COUNT(*) as count FROM bingo_v2_room_players 
           WHERE room_id = (SELECT id FROM bingo_v2_rooms WHERE code = $1)
           AND is_connected = true`,
          [roomCode]
        );

        if (parseInt(activePlayersResult.rows[0].count) === 0) {
          // Start 30-second timer for room cancellation
          setTimeout(async () => {
            const recheckResult = await query(
              `SELECT COUNT(*) as count FROM bingo_v2_room_players 
               WHERE room_id = (SELECT id FROM bingo_v2_rooms WHERE code = $1)
               AND is_connected = true`,
              [roomCode]
            );

            if (parseInt(recheckResult.rows[0].count) === 0) {
              // Cancel room and refund
              const roomResult = await query(
                `SELECT id FROM bingo_v2_rooms WHERE code = $1 AND status != 'finished'`,
                [roomCode]
              );
              
              if (roomResult.rows.length > 0) {
                await BingoV2Service.cancelRoom(roomResult.rows[0].id, 'Room abandoned');
                io.to(roomCode).emit('bingo:room_cancelled', { reason: 'Room abandoned' });
              }
            }
          }, 30000);
        }

        logger.info(`User ${userId} left room ${roomCode}`);
      } catch (error) {
        logger.error('Error leaving room:', error);
        socket.emit('bingo:error', { message: error.message });
      }
    });

    // Mark player ready
    socket.on('bingo:player_ready', async (data) => {
      try {
        const { roomCode, userId } = data;
        
        await query(
          `UPDATE bingo_v2_room_players 
           SET is_ready = true
           WHERE room_id = (SELECT id FROM bingo_v2_rooms WHERE code = $1)
           AND user_id = $2`,
          [roomCode, userId]
        );

        io.to(roomCode).emit('bingo:player_ready', { userId });
        
        logger.info(`User ${userId} is ready in room ${roomCode}`);
      } catch (error) {
        logger.error('Error marking player ready:', error);
        socket.emit('bingo:error', { message: error.message });
      }
    });

    // Start game
    socket.on('bingo:start_game', async (data) => {
      try {
        const { roomCode, userId } = data;
        
        // Get room
        const roomResult = await query(
          `SELECT id FROM bingo_v2_rooms WHERE code = $1`,
          [roomCode]
        );
        
        if (roomResult.rows.length === 0) {
          throw new Error('Room not found');
        }
        
        const roomId = roomResult.rows[0].id;
        const result = await BingoV2Service.startGame(roomId, userId);
        
        io.to(roomCode).emit('bingo:game_started', result);
        
        logger.info(`Game started in room ${roomCode}`);
      } catch (error) {
        logger.error('Error starting game:', error);
        socket.emit('bingo:error', { message: error.message });
      }
    });

    // Call number
    socket.on('bingo:call_number', async (data) => {
      try {
        const { roomCode, userId, isAuto = false } = data;
        
        // Get room
        const roomResult = await query(
          `SELECT id FROM bingo_v2_rooms WHERE code = $1`,
          [roomCode]
        );
        
        if (roomResult.rows.length === 0) {
          throw new Error('Room not found');
        }
        
        const roomId = roomResult.rows[0].id;
        const result = await BingoV2Service.callNumber(roomId, userId, isAuto);
        
        io.to(roomCode).emit('bingo:number_called', result);
        
        logger.info(`Number ${result.number} called in room ${roomCode}`);
      } catch (error) {
        logger.error('Error calling number:', error);
        socket.emit('bingo:error', { message: error.message });
      }
    });

    // Toggle auto-call
    socket.on('bingo:toggle_auto_call', async (data) => {
      try {
        const { roomCode, userId, enable } = data;
        
        // Check user experience
        const userResult = await query(
          `SELECT experience FROM users WHERE id = $1`,
          [userId]
        );
        
        const userExp = userResult.rows[0]?.experience || 0;
        
        if (enable && userExp < 400) {
          socket.emit('bingo:error', {
            message: `Aún te falta ${400 - userExp} experiencia para activar este modo`
          });
          return;
        }

        // Get room
        const roomResult = await query(
          `SELECT id, host_id FROM bingo_v2_rooms WHERE code = $1`,
          [roomCode]
        );
        
        if (roomResult.rows.length === 0) {
          throw new Error('Room not found');
        }
        
        const room = roomResult.rows[0];
        
        if (room.host_id !== userId) {
          throw new Error('Only host can toggle auto-call');
        }

        if (enable) {
          // Start auto-call interval
          const interval = setInterval(async () => {
            try {
              const result = await BingoV2Service.callNumber(room.id, userId, true);
              io.to(roomCode).emit('bingo:number_called', result);
            } catch (error) {
              // Stop if error (probably all numbers called)
              clearInterval(interval);
              autoCallIntervals.delete(roomCode);
            }
          }, 5000);
          
          autoCallIntervals.set(roomCode, interval);
          
          // Update room
          await query(
            `UPDATE bingo_v2_rooms SET auto_call_enabled = true WHERE id = $1`,
            [room.id]
          );
          
          io.to(roomCode).emit('bingo:auto_call_enabled');
        } else {
          // Stop auto-call
          if (autoCallIntervals.has(roomCode)) {
            clearInterval(autoCallIntervals.get(roomCode));
            autoCallIntervals.delete(roomCode);
          }
          
          // Update room
          await query(
            `UPDATE bingo_v2_rooms SET auto_call_enabled = false WHERE id = $1`,
            [room.id]
          );
          
          io.to(roomCode).emit('bingo:auto_call_disabled');
        }
        
        logger.info(`Auto-call ${enable ? 'enabled' : 'disabled'} in room ${roomCode}`);
      } catch (error) {
        logger.error('Error toggling auto-call:', error);
        socket.emit('bingo:error', { message: error.message });
      }
    });

    // Mark number
    socket.on('bingo:mark_number', async (data, callback) => {
      try {
        const { roomCode, userId, cardId, position } = data;
        
        // CRITICAL DEBUG: Log incoming data
        logger.info('📍 mark_number received:', {
          roomCode,
          userId,
          cardId,
          position,
          positionType: typeof position,
          dataKeys: Object.keys(data || {})
        });
        
        // CRITICAL VALIDATION: Check userId
        if (!userId || typeof userId !== 'string') {
          logger.error('❌ Invalid userId:', { userId, type: typeof userId });
          if (callback) callback({ error: 'Invalid user ID' });
          return;
        }
        
        // CRITICAL VALIDATION: Check position
        if (!position || typeof position !== 'object' || 
            typeof position.row !== 'number' || typeof position.col !== 'number') {
          logger.error('❌ Invalid position:', { position, type: typeof position });
          if (callback) callback({ error: 'Invalid position data' });
          return;
        }
        
        // Get room
        const roomResult = await query(
          `SELECT id FROM bingo_v2_rooms WHERE code = $1`,
          [roomCode]
        );
        
        if (roomResult.rows.length === 0) {
          throw new Error('Room not found');
        }
        
        // Get player
        const playerResult = await query(
          `SELECT id FROM bingo_v2_room_players 
           WHERE room_id = $1 AND user_id = $2`,
          [roomResult.rows[0].id, userId]
        );
        
        if (playerResult.rows.length === 0) {
          throw new Error('Player not in room');
        }
        
        const result = await BingoV2Service.markNumber(
          roomResult.rows[0].id,
          playerResult.rows[0].id,
          cardId,
          position
        );
        
        // Broadcast to room
        io.to(roomCode).emit('bingo:number_marked', result);
        
        // Send callback confirmation
        if (callback) {
          callback({ marked: true, ...result });
        }
        
        logger.info(`Number marked on card ${cardId} in room ${roomCode}`);
      } catch (error) {
        logger.error('Error marking number:', error);
        
        // Send error callback
        if (callback) {
          callback({ marked: false, error: error.message });
        }
        
        socket.emit('bingo:error', { message: error.message });
      }
    });

    // Call bingo
    socket.on('bingo:call_bingo', async (data, callback) => {
      try {
        const { roomCode, userId, cardId, pattern } = data;
        
        console.log('🎯 BINGO CALLED:', { roomCode, userId, cardId, pattern });
        
        // Get room
        const roomResult = await query(
          `SELECT * FROM bingo_v2_rooms WHERE code = $1`,
          [roomCode]
        );
        
        if (roomResult.rows.length === 0) {
          throw new Error('Room not found');
        }
        
        const room = roomResult.rows[0];
        
        // Get player
        const playerResult = await query(
          `SELECT id FROM bingo_v2_room_players 
           WHERE room_id = $1 AND user_id = $2`,
          [room.id, userId]
        );
        
        if (playerResult.rows.length === 0) {
          throw new Error('Player not in room');
        }
        
        const result = await BingoV2Service.validateBingo(
          room.id,
          playerResult.rows[0].id,
          cardId,
          pattern || room.pattern_type
        );
        
        if (result.valid) {
          // Stop auto-call if enabled
          if (autoCallIntervals.has(roomCode)) {
            clearInterval(autoCallIntervals.get(roomCode));
            autoCallIntervals.delete(roomCode);
          }

          // Get winner details
          const winnerResult = await query(
            `SELECT u.username FROM users u 
             JOIN bingo_v2_room_players p ON u.id = p.user_id
             WHERE p.id = $1`,
            [playerResult.rows[0].id]
          );

          // Emit game over to all
          io.to(roomCode).emit('bingo:game_over', {
            winner: {
              userId,
              username: winnerResult.rows[0].username,
              pattern: result.pattern
            },
            prizes: result.prizes
          });

          console.log('🎉 BINGO VALIDATED! Game over emitted');
        }
        
        // Send callback response
        if (callback) {
          callback({
            success: result.valid,
            message: result.valid ? '¡BINGO VÁLIDO!' : 'Patrón no completado'
          });
        }
        
        logger.info(`Bingo ${result.valid ? 'validated' : 'invalid'} in room ${roomCode}`);
      } catch (error) {
        logger.error('Error validating bingo:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    // Chat message
    socket.on('bingo:chat_message', async (data) => {
      try {
        const { roomCode, userId, message } = data;
        
        // Get room
        const roomResult = await query(
          `SELECT id FROM bingo_v2_rooms WHERE code = $1`,
          [roomCode]
        );
        
        if (roomResult.rows.length === 0) {
          throw new Error('Room not found');
        }
        
        // Save message
        await query(
          `INSERT INTO bingo_v2_room_chat_messages (room_id, user_id, message)
           VALUES ($1, $2, $3)`,
          [roomResult.rows[0].id, userId, message]
        );
        
        // Get username
        const userResult = await query(
          `SELECT username FROM users WHERE id = $1`,
          [userId]
        );
        
        // Broadcast to room
        io.to(roomCode).emit('bingo:chat_message', {
          userId,
          username: userResult.rows[0].username,
          message,
          timestamp: new Date()
        });
        
        logger.info(`Chat message in room ${roomCode}`);
      } catch (error) {
        logger.error('Error sending chat message:', error);
        socket.emit('bingo:error', { message: error.message });
      }
    });

    // Host disconnection monitoring
    socket.on('disconnect', async () => {
      try {
        // Find user's room
        let userId = null;
        let roomCode = null;
        
        for (const [uid, room] of userToRoom.entries()) {
          if (socket.id === uid) {
            userId = uid;
            roomCode = room;
            break;
          }
        }
        
        if (userId && roomCode) {
          // Update connection status
          await query(
            `UPDATE bingo_v2_room_players 
             SET is_connected = false, last_activity = NOW()
             WHERE user_id = $1`,
            [userId]
          );
          
          // Check if host
          const roomResult = await query(
            `SELECT id, host_id FROM bingo_v2_rooms 
             WHERE code = $1 AND status = 'in_progress'`,
            [roomCode]
          );
          
          if (roomResult.rows.length > 0 && roomResult.rows[0].host_id === userId) {
            const roomId = roomResult.rows[0].id;
            
            // Try to force auto-call if host has >=500 XP
            try {
              const autoCallResult = await BingoV2Service.forceAutoCallOnHostLeave(roomId, userId);
              
              if (autoCallResult.activated) {
                // Notify room that auto-call was activated
                io.to(roomCode).emit('bingo:auto_call_forced', {
                  message: autoCallResult.message,
                  roomCode: autoCallResult.roomCode
                });
                
                logger.info(`Auto-call forced for room ${roomCode} after host ${userId} left`);
              }
            } catch (err) {
              logger.error('Error forcing auto-call on host leave:', err);
            }
            
            // Start 5-minute timer for host reconnection monitoring
            setTimeout(async () => {
              const hostCheck = await query(
                `SELECT is_connected FROM bingo_v2_room_players 
                 WHERE room_id = $1 AND user_id = $2`,
                [roomId, userId]
              );
              
              if (hostCheck.rows.length > 0 && !hostCheck.rows[0].is_connected) {
                // Send Telegram notification
                try {
                  await telegramService.sendMessage(
                    '1417856820',
                    `⚠️ Host desconectado por más de 5 minutos en sala ${roomCode}`
                  );
                } catch (err) {
                  logger.error('Error sending Telegram notification:', err);
                }
              }
            }, 300000); // 5 minutes
          }
        }
        
        logger.info('Socket disconnected:', socket.id);
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });
  });
}

module.exports = handleBingoV2Socket;
