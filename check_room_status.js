/**
 * Verificar status de la sala ABPYQ5
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

async function checkRoom() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    console.log('🔍 Verificando sala ABPYQ5...\n');
    
    const room = await client.query(`
      SELECT 
        id,
        code,
        status,
        host_id,
        room_name,
        currency,
        card_cost,
        max_players,
        numbers_mode,
        victory_mode,
        created_at,
        last_activity
      FROM bingo_rooms 
      WHERE code = 'ABPYQ5'
    `);
    
    if (room.rows.length === 0) {
      console.log('❌ Sala no encontrada');
      return;
    }
    
    const r = room.rows[0];
    console.log('📊 Información de la sala:');
    console.log(`   Código: ${r.code}`);
    console.log(`   Status: ${r.status} ⬅️ ESTE ES EL PROBLEMA`);
    console.log(`   Host ID: ${r.host_id}`);
    console.log(`   Nombre: ${r.room_name || '(sin nombre)'}`);
    console.log(`   Moneda: ${r.currency}`);
    console.log(`   Costo cartón: ${r.card_cost}`);
    console.log(`   Max jugadores: ${r.max_players}`);
    console.log(`   Modo: ${r.numbers_mode} números`);
    console.log(`   Victoria: ${r.victory_mode}`);
    console.log(`   Creada: ${r.created_at}`);
    console.log(`   Última actividad: ${r.last_activity}`);
    
    console.log('\n📋 Jugadores en la sala:');
    const players = await client.query(`
      SELECT 
        brp.user_id,
        u.username,
        brp.cards_owned,
        brp.is_ready,
        brp.is_host
      FROM bingo_room_players brp
      JOIN users u ON u.id = brp.user_id
      WHERE brp.room_id = $1
    `, [r.id]);
    
    if (players.rows.length === 0) {
      console.log('   (Sin jugadores)');
    } else {
      players.rows.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.username} - ${p.cards_owned} cartones - ${p.is_ready ? '✅ Listo' : '⏳ No listo'} ${p.is_host ? '(HOST)' : ''}`);
      });
    }
    
    console.log('\n🔧 DIAGNÓSTICO:');
    if (r.status === 'waiting' || r.status === 'ready') {
      console.log('   ✅ Status correcto - usuarios DEBERÍAN poder unirse');
    } else {
      console.log(`   ❌ Status incorrecto: "${r.status}"`);
      console.log('   ⚠️  Solo se permite unirse con status "waiting" o "ready"');
      console.log('\n💡 SOLUCIÓN: Cambiar status a "waiting"');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await client.end();
  }
}

checkRoom()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
