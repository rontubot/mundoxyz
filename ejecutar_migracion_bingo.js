const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function ejecutarMigracionBingo() {
  const client = new Client({
    connectionString: process.argv[2],
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'migrations', '003_bingo_tables.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('🚀 EJECUTANDO MIGRACIÓN DE BINGO...\n');
    console.log('─'.repeat(60));

    // Ejecutar la migración
    await client.query(sqlContent);

    console.log('✅ Migración ejecutada exitosamente\n');

    // Verificar las tablas creadas
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'bingo_%'
      ORDER BY table_name;
    `;

    const result = await client.query(tablesQuery);

    console.log('📊 TABLAS DE BINGO CREADAS:');
    console.log('─'.repeat(60));
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    console.log('─'.repeat(60));

    // Verificar estadísticas
    const statsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_stats' 
      AND column_name LIKE 'bingo_%'
      ORDER BY column_name;
    `;

    const statsResult = await client.query(statsQuery);

    console.log('\n📈 COLUMNAS DE ESTADÍSTICAS AGREGADAS:');
    console.log('─'.repeat(60));
    statsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}`);
    });
    console.log('─'.repeat(60));

    // Contar índices
    const indexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename LIKE 'bingo_%' 
      AND schemaname = 'public';
    `;

    const indexResult = await client.query(indexQuery);

    console.log(`\n🔍 ÍNDICES CREADOS: ${indexResult.rows.length}`);
    console.log('─'.repeat(60));

    console.log('\n🎉 SISTEMA DE BINGO INSTALADO EXITOSAMENTE!');
    console.log('\n📝 PRÓXIMOS PASOS:');
    console.log('  1. Verificar conexión en el backend');
    console.log('  2. Implementar servicios de bingo');
    console.log('  3. Crear endpoints REST');
    console.log('  4. Configurar WebSocket para tiempo real');
    console.log('  5. Desarrollar UI del lobby y salas');

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error('\n📋 Detalles del error:', error.stack);
    
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Algunas tablas ya existen. Esto es normal si es una re-ejecución.');
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Conexión cerrada');
  }
}

// Validar argumentos
if (!process.argv[2]) {
  console.log('❌ Falta la URL de conexión de Railway');
  console.log('\n📖 USO:');
  console.log('  node ejecutar_migracion_bingo.js "postgresql://..."');
  console.log('\n💡 EJEMPLO:');
  console.log('  node ejecutar_migracion_bingo.js "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway"');
  process.exit(1);
}

// Ejecutar
console.log('🎰 MIGRACIÓN DE BINGO PARA MUNDOXYZ');
console.log('═'.repeat(60));
console.log('📅 Fecha:', new Date().toLocaleString('es-ES'));
console.log('🔗 Base de datos: Railway PostgreSQL');
console.log('═'.repeat(60) + '\n');

ejecutarMigracionBingo();
