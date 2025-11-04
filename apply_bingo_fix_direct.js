/**
 * Script para aplicar fix de Bingo directamente a Railway
 * Ejecuta: node apply_bingo_fix_direct.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

async function applyFix() {
  console.log('🔧 Aplicando fix de Bingo a Railway PostgreSQL...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Conectar
    console.log('📡 Conectando a Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado exitosamente\n');
    
    // Leer archivo SQL
    const sqlPath = path.join(__dirname, 'fix_bingo_function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Ejecutando SQL fix...');
    console.log('─'.repeat(60));
    
    // Ejecutar SQL
    const result = await client.query(sql);
    
    console.log('✅ SQL ejecutado exitosamente!\n');
    
    // Verificar que la función existe
    console.log('🔍 Verificando función...');
    const verifyResult = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'generate_unique_bingo_room_code'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Función encontrada:', verifyResult.rows[0].proname);
    } else {
      console.log('⚠️  ADVERTENCIA: Función no encontrada');
    }
    
    // Probar generación de códigos
    console.log('\n🧪 Probando generación de códigos únicos...');
    for (let i = 1; i <= 3; i++) {
      const codeResult = await client.query('SELECT generate_unique_bingo_room_code() as code');
      console.log(`   ${i}. Código generado: ${codeResult.rows[0].code}`);
    }
    
    console.log('\n✅ ¡Fix aplicado correctamente!');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Ir a: https://confident-bravery-production-ce7b.up.railway.app/bingo/lobby');
    console.log('   2. Click en "Crear Sala"');
    console.log('   3. Configurar sala y crear');
    console.log('   4. Verificar que NO aparece error "code is ambiguous"');
    
  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('   Mensaje:', error.message);
    if (error.code) console.error('   Código:', error.code);
    if (error.detail) console.error('   Detalle:', error.detail);
    console.error('\n   Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Desconectado de base de datos');
  }
}

// Ejecutar
console.log('🚀 MUNDOXYZ - Aplicar Fix de Bingo\n');
applyFix()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
