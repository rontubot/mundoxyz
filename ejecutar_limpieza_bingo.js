const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function ejecutarLimpiezaBingo() {
  const client = new Client({
    connectionString: process.argv[2],
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'migrations', '004_cleanup_and_recreate_bingo.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('🧹 LIMPIANDO TABLAS ANTIGUAS DE BINGO...');
    console.log('🚀 CREANDO NUEVO SISTEMA DE BINGO...\n');
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

    console.log('📊 NUEVAS TABLAS DE BINGO CREADAS:');
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
    if (statsResult.rows.length > 0) {
      statsResult.rows.forEach(row => {
        console.log(`  ✓ ${row.column_name}`);
      });
    } else {
      console.log('  ❌ No se agregaron columnas de estadísticas');
    }
    console.log('─'.repeat(60));

    // Contar índices
    const indexQuery = `
      SELECT COUNT(*) as count
      FROM pg_indexes 
      WHERE tablename LIKE 'bingo_%' 
      AND schemaname = 'public';
    `;

    const indexResult = await client.query(indexQuery);

    console.log(`\n🔍 ÍNDICES CREADOS: ${indexResult.rows[0].count}`);
    console.log('─'.repeat(60));

    // Verificar funciones
    const functionsQuery = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_type = 'FUNCTION' 
      AND routine_schema = 'public'
      AND routine_name LIKE '%bingo%';
    `;

    const functionsResult = await client.query(functionsQuery);

    console.log(`\n⚙️  FUNCIONES CREADAS: ${functionsResult.rows.length}`);
    if (functionsResult.rows.length > 0) {
      console.log('─'.repeat(60));
      functionsResult.rows.forEach(row => {
        console.log(`  ✓ ${row.routine_name}()`);
      });
    }
    console.log('─'.repeat(60));

    console.log('\n🎉 SISTEMA DE BINGO INSTALADO EXITOSAMENTE!');
    console.log('\n✨ RESUMEN:');
    console.log('  • Tablas antiguas eliminadas');
    console.log('  • Nuevo sistema de bingo creado');
    console.log('  • Índices optimizados agregados');
    console.log('  • Funciones y triggers instalados');
    console.log('  • Columnas de estadísticas agregadas');
    
    console.log('\n📝 PRÓXIMOS PASOS:');
    console.log('  1. Hacer commit de los cambios');
    console.log('  2. Push a GitHub para deploy automático');
    console.log('  3. Verificar el backend en Railway');
    console.log('  4. Implementar el frontend del lobby');

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    console.error('\n📋 Detalles del error:', error.stack);
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
  console.log('  node ejecutar_limpieza_bingo.js "postgresql://..."');
  console.log('\n💡 EJEMPLO:');
  console.log('  node ejecutar_limpieza_bingo.js "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway"');
  process.exit(1);
}

// Ejecutar
console.log('🎰 LIMPIEZA Y RECREACIÓN DE BINGO - MUNDOXYZ');
console.log('═'.repeat(60));
console.log('📅 Fecha:', new Date().toLocaleString('es-ES'));
console.log('🔗 Base de datos: Railway PostgreSQL');
console.log('═'.repeat(60) + '\n');

ejecutarLimpiezaBingo();
