/**
 * Script para aplicar fix de función generate_unique_bingo_room_code
 * Resuelve: "column reference 'code' is ambiguous"
 * 
 * Uso:
 *   node apply_bingo_fix.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno si existe .env
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está definida');
  console.error('Configura la variable de entorno DATABASE_URL o crea un archivo .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyFix() {
  console.log('🔧 Aplicando fix para generate_unique_bingo_room_code()...\n');

  try {
    // Leer archivo SQL
    const sqlPath = path.join(__dirname, 'fix_bingo_function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Archivo SQL cargado:', sqlPath);
    console.log('📝 Contenido:');
    console.log('─'.repeat(60));
    console.log(sql.substring(0, 500) + '...\n');
    console.log('─'.repeat(60));
    
    // Ejecutar SQL
    console.log('\n⚙️  Ejecutando SQL...');
    const result = await pool.query(sql);
    
    console.log('✅ Fix aplicado exitosamente!\n');
    
    // Verificar que la función se creó correctamente
    console.log('🔍 Verificando función...');
    const verifyResult = await pool.query(`
      SELECT 
        proname as nombre,
        pg_get_functiondef(oid) as definicion
      FROM pg_proc 
      WHERE proname = 'generate_unique_bingo_room_code'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Función encontrada en la base de datos');
      console.log(`   Nombre: ${verifyResult.rows[0].nombre}`);
      console.log(`   Definición: ${verifyResult.rows[0].definicion.substring(0, 100)}...`);
    } else {
      console.log('⚠️  ADVERTENCIA: Función no encontrada después del fix');
    }
    
    // Probar generación de código
    console.log('\n🧪 Probando generación de códigos únicos...');
    for (let i = 1; i <= 5; i++) {
      const codeResult = await pool.query('SELECT generate_unique_bingo_room_code() as code');
      const generatedCode = codeResult.rows[0].code;
      console.log(`   ${i}. Código generado: ${generatedCode}`);
    }
    
    console.log('\n✅ ¡Todo funcionando correctamente!');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Probar crear una sala de Bingo desde el frontend');
    console.log('   2. Verificar que no aparece el error "code is ambiguous"');
    console.log('   3. Confirmar que la sala se crea exitosamente');
    
  } catch (error) {
    console.error('\n❌ ERROR al aplicar fix:');
    console.error('   Mensaje:', error.message);
    console.error('   Código:', error.code);
    if (error.position) {
      console.error('   Posición:', error.position);
    }
    console.error('\n   Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar
console.log('🚀 MUNDOXYZ - Fix de Bingo\n');
console.log('Conectando a base de datos...');
console.log(`Database: ${DATABASE_URL.split('@')[1] || 'localhost'}\n`);

applyFix()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
