// Script para diagnosticar el estado de un usuario en Railway
const { Client } = require('pg');
const readline = require('readline');

const connectionString = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function diagnoseUser(username) {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    console.log(`🔍 Buscando usuario: ${username}\n`);
    
    // Buscar usuario
    const userResult = await client.query(
      'SELECT id, username, telegram_id, email, roles FROM users WHERE username ILIKE $1 OR telegram_id = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuario NO encontrado\n');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ Usuario encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Telegram ID: ${user.telegram_id || 'N/A'}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Roles: ${JSON.stringify(user.roles)}\n`);
    
    // Verificar wallet
    console.log('🔍 Verificando wallet...\n');
    const walletResult = await client.query(
      'SELECT id, coins_balance, fires_balance, total_coins_earned, total_fires_earned FROM wallets WHERE user_id = $1',
      [user.id]
    );
    
    if (walletResult.rows.length === 0) {
      console.log('❌ WALLET NO EXISTE para este usuario\n');
      console.log('⚠️  Este es probablemente el problema!\n');
      console.log('Solución: Crear wallet con comando:\n');
      console.log(`INSERT INTO wallets (id, user_id, coins_balance, fires_balance)`);
      console.log(`VALUES (gen_random_uuid(), '${user.id}', 100, 5);`);
    } else {
      const wallet = walletResult.rows[0];
      console.log('✅ Wallet encontrado:');
      console.log(`   ID: ${wallet.id}`);
      console.log(`   Coins: ${wallet.coins_balance}`);
      console.log(`   Fires: ${wallet.fires_balance}`);
      console.log(`   Total Coins Earned: ${wallet.total_coins_earned}`);
      console.log(`   Total Fires Earned: ${wallet.total_fires_earned}\n`);
      
      // Verificar si puede jugar La Vieja
      const coins = parseFloat(wallet.coins_balance);
      const fires = parseFloat(wallet.fires_balance);
      
      console.log('🎮 ¿Puede jugar La Vieja?\n');
      
      if (coins >= 1) {
        console.log(`   ✅ Sí - Modo Coins (tiene ${coins} coins)\n`);
      } else {
        console.log(`   ❌ No - Modo Coins (solo tiene ${coins} coins, necesita mínimo 1)\n`);
      }
      
      if (fires >= 1) {
        console.log(`   ✅ Sí - Modo Fires (tiene ${fires} fires)\n`);
      } else {
        console.log(`   ❌ No - Modo Fires (solo tiene ${fires} fires, necesita mínimo 1)\n`);
      }
    }
    
    // Verificar salas activas
    console.log('🔍 Verificando salas activas de TicTacToe...\n');
    const roomsResult = await client.query(
      `SELECT id, code, mode, bet_amount, status, player_x_id, player_o_id 
       FROM tictactoe_rooms 
       WHERE (host_id = $1 OR player_x_id = $1 OR player_o_id = $1)
       AND status IN ('waiting', 'ready', 'playing')
       ORDER BY created_at DESC
       LIMIT 5`,
      [user.id]
    );
    
    if (roomsResult.rows.length === 0) {
      console.log('   ℹ️  No tiene salas activas\n');
    } else {
      console.log(`   ✅ ${roomsResult.rows.length} salas activas:`);
      roomsResult.rows.forEach(room => {
        console.log(`      - Sala ${room.code}: ${room.status} (${room.mode}, ${room.bet_amount})`);
      });
      console.log('');
    }
    
    console.log('==================================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Preguntar por el username
rl.question('Ingresa el username o telegram_id del usuario: ', (answer) => {
  if (!answer || answer.trim() === '') {
    console.log('\n❌ Debes ingresar un username o telegram_id\n');
    rl.close();
    process.exit(1);
  }
  
  diagnoseUser(answer.trim()).then(() => {
    rl.close();
  });
});
