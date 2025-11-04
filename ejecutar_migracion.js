// Script para ejecutar migración SQL en Railway PostgreSQL
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de conexión
const connectionString = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

// Leer archivo SQL
const sqlFile = path.join(__dirname, 'MIGRACION_LA_VIEJA.sql');

console.log('==================================================');
console.log('🚀 EJECUTANDO MIGRACIÓN LA VIEJA EN RAILWAY');
console.log('==================================================\n');

if (!fs.existsSync(sqlFile)) {
  console.error('❌ ERROR: No se encuentra el archivo MIGRACION_LA_VIEJA.sql');
  process.exit(1);
}

console.log('✓ Archivo SQL encontrado');

const sqlContent = fs.readFileSync(sqlFile, 'utf8');

console.log('✓ Contenido SQL cargado');
console.log('✓ Conectando a Railway PostgreSQL...\n');

// Crear cliente PostgreSQL
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    // Conectar
    await client.connect();
    console.log('✅ Conectado exitosamente a Railway PostgreSQL\n');
    
    console.log('📊 Ejecutando migración...\n');
    
    // Ejecutar el SQL completo
    const result = await client.query(sqlContent);
    
    console.log('✅ Migración ejecutada exitosamente!\n');
    
    // Verificar que se crearon las tablas
    console.log('🔍 Verificando tablas creadas...\n');
    const verification = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'tictactoe%'
      ORDER BY table_name;
    `);
    
    console.log('✅ Tablas creadas:');
    verification.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    console.log('\n==================================================');
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('==================================================');
    
  } catch (error) {
    console.error('\n❌ ERROR al ejecutar migración:');
    console.error(error.message);
    
    if (error.detail) {
      console.error('\nDetalle:', error.detail);
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Ejecutar
runMigration();
