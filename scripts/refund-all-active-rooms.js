/**
 * Script para cerrar y reembolsar todas las salas activas
 * Fecha: 2 Noviembre 2025
 * Uso: node scripts/refund-all-active-rooms.js
 */

const { Pool } = require('pg');

// Configuración de conexión a Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[✓] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

async function getActivRooms() {
  const result = await pool.query(`
    SELECT 
      r.id,
      r.code,
      r.status,
      r.currency_type,
      r.host_id,
      u.username as host_name,
      COUNT(DISTINCT p.id) FILTER (WHERE p.cards_purchased > 0) as players_with_cards,
      SUM(p.total_spent) FILTER (WHERE p.cards_purchased > 0) as total_to_refund,
      r.prize_pool
    FROM bingo_v2_rooms r
    LEFT JOIN users u ON r.host_id = u.id
    LEFT JOIN bingo_v2_room_players p ON r.id = p.room_id
    WHERE r.status IN ('waiting', 'in_progress')
    GROUP BY r.id, r.code, r.status, r.currency_type, r.host_id, u.username
    ORDER BY r.status, r.code
  `);
  
  return result.rows;
}

async function refundRoom(room) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    log.info(`Procesando sala #${room.code} (${room.status})`);
    
    // 1. Obtener jugadores con cartones comprados
    const playersResult = await client.query(`
      SELECT 
        p.id,
        p.user_id,
        p.total_spent,
        u.username
      FROM bingo_v2_room_players p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.room_id = $1 AND p.cards_purchased > 0
    `, [room.id]);
    
    const players = playersResult.rows;
    log.info(`  Jugadores a reembolsar: ${players.length}`);
    
    if (players.length === 0) {
      log.warn(`  Sala sin jugadores con cartones, solo se marcará como cancelada`);
    }
    
    // 2. Reembolsar a cada jugador
    let totalRefunded = 0;
    const currencyColumn = room.currency_type === 'coins' ? 'coins_balance' : 'fires_balance';
    
    for (const player of players) {
      if (!player.total_spent || player.total_spent <= 0) {
        log.warn(`  Saltando jugador ${player.username} (sin gasto registrado)`);
        continue;
      }
      
      // Reembolsar a wallet
      await client.query(`
        UPDATE wallets 
        SET ${currencyColumn} = ${currencyColumn} + $1
        WHERE user_id = $2
      `, [player.total_spent, player.user_id]);
      
      // Registrar en tabla de refunds
      await client.query(`
        INSERT INTO bingo_v2_refunds 
        (room_id, player_id, user_id, amount, currency_type, reason, refunded_by, notes)
        VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)
      `, [
        room.id,
        player.id,
        player.user_id,
        player.total_spent,
        room.currency_type,
        'admin_forced',
        `Cierre masivo de salas - Script automatizado`
      ]);
      
      // Enviar mensaje al buzón
      await client.query(`
        INSERT INTO bingo_v2_messages 
        (user_id, category, title, content, metadata)
        VALUES ($1, 'system', $2, $3, $4)
      `, [
        player.user_id,
        'Reembolso de Bingo',
        `Sala #${room.code} fue cerrada. Has recibido un reembolso de ${player.total_spent} ${room.currency_type}.`,
        JSON.stringify({
          room_code: room.code,
          amount: player.total_spent,
          currency: room.currency_type,
          reason: 'admin_forced',
          timestamp: new Date().toISOString()
        })
      ]);
      
      totalRefunded += parseFloat(player.total_spent);
      log.success(`  ✓ Reembolsado ${player.total_spent} ${room.currency_type} a ${player.username}`);
    }
    
    // 3. Actualizar estado de la sala
    await client.query(`
      UPDATE bingo_v2_rooms
      SET 
        status = 'cancelled',
        finished_at = NOW(),
        is_stalled = false
      WHERE id = $1
    `, [room.id]);
    
    // 4. Registrar en audit log
    await client.query(`
      INSERT INTO bingo_v2_audit_logs
      (room_id, action, user_id, details)
      VALUES ($1, 'room_cancelled', $2, $3)
    `, [
      room.id,
      room.host_id,
      JSON.stringify({
        reason: 'admin_forced',
        refunded_players: players.length,
        total_refunded: totalRefunded,
        currency_type: room.currency_type,
        automated_script: true,
        timestamp: new Date().toISOString()
      })
    ]);
    
    await client.query('COMMIT');
    
    log.success(`✓ Sala #${room.code} cerrada exitosamente`);
    log.info(`  Total reembolsado: ${totalRefunded.toFixed(2)} ${room.currency_type}`);
    
    return {
      success: true,
      roomCode: room.code,
      playersRefunded: players.length,
      totalRefunded: totalRefunded
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    log.error(`Error procesando sala #${room.code}: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    log.info('=== INICIO DE CIERRE MASIVO DE SALAS ===');
    log.info('Conectando a base de datos...');
    
    // Test conexión
    await pool.query('SELECT NOW()');
    log.success('Conexión exitosa');
    
    // Obtener salas activas
    log.info('Consultando salas activas...');
    const activeRooms = await getActivRooms();
    
    if (activeRooms.length === 0) {
      log.warn('No hay salas activas para cerrar');
      await pool.end();
      return;
    }
    
    log.info(`Encontradas ${activeRooms.length} salas activas:`);
    activeRooms.forEach(room => {
      log.info(`  - #${room.code} (${room.status}) - Host: ${room.host_name} - Jugadores: ${room.players_with_cards} - A reembolsar: ${room.total_to_refund || 0} ${room.currency_type}`);
    });
    
    console.log('\n');
    log.warn('CONFIRMACIÓN REQUERIDA: ¿Desea continuar con el cierre de TODAS estas salas?');
    log.warn('Presione Ctrl+C para cancelar, o espere 5 segundos para continuar...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Procesar cada sala
    const results = {
      success: [],
      failed: []
    };
    
    for (const room of activeRooms) {
      try {
        const result = await refundRoom(room);
        results.success.push(result);
      } catch (error) {
        results.failed.push({
          roomCode: room.code,
          error: error.message
        });
      }
    }
    
    // Resumen final
    console.log('\n');
    log.info('=== RESUMEN FINAL ===');
    log.success(`Salas cerradas exitosamente: ${results.success.length}`);
    
    if (results.success.length > 0) {
      const totalRefunded = results.success.reduce((sum, r) => sum + r.totalRefunded, 0);
      const totalPlayers = results.success.reduce((sum, r) => sum + r.playersRefunded, 0);
      
      log.info(`Total de jugadores reembolsados: ${totalPlayers}`);
      log.info(`Monto total reembolsado: ${totalRefunded.toFixed(2)}`);
      
      console.log('\nDetalle de salas cerradas:');
      results.success.forEach(r => {
        log.success(`  ✓ #${r.roomCode} - ${r.playersRefunded} jugadores - ${r.totalRefunded.toFixed(2)} reembolsado`);
      });
    }
    
    if (results.failed.length > 0) {
      log.error(`Salas con error: ${results.failed.length}`);
      results.failed.forEach(r => {
        log.error(`  ✗ #${r.roomCode} - ${r.error}`);
      });
    }
    
    // Guardar log en archivo
    const logData = {
      timestamp: new Date().toISOString(),
      total_rooms: activeRooms.length,
      success_count: results.success.length,
      failed_count: results.failed.length,
      results: results
    };
    
    const fs = require('fs');
    const logFile = `logs/refund-mass-${Date.now()}.json`;
    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
    log.success(`Log guardado en: ${logFile}`);
    
  } catch (error) {
    log.error(`Error fatal: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
    log.info('=== FIN DEL PROCESO ===');
  }
}

// Manejo de señales
process.on('SIGINT', async () => {
  log.warn('\nProceso cancelado por el usuario');
  await pool.end();
  process.exit(0);
});

process.on('unhandledRejection', async (error) => {
  log.error(`Promesa rechazada no manejada: ${error.message}`);
  console.error(error);
  await pool.end();
  process.exit(1);
});

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = { getActivRooms, refundRoom };
