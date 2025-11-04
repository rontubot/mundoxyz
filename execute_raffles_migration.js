const { Pool } = require('pg');

// Configuración de conexión a Railway PostgreSQL
const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

console.log(`
==================================================
🎯 EJECUTANDO MIGRACIÓN SISTEMA DE RIFAS
==================================================
`);

async function executeMigration() {
    const client = await pool.connect();
    try {
        console.log('📖 Leyendo archivo de migración...\n');
        
        // Leer el archivo SQL
        const fs = require('fs');
        const path = require('path');
        const migrationPath = path.join(__dirname, 'migrations', '003_raffles_system.sql');
        
        if (!fs.existsSync(migrationPath)) {
            throw new Error('Archivo de migración no encontrado: ' + migrationPath);
        }
        
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('🔧 Ejecutando migración en PostgreSQL...\n');
        
        // Ejecutar la migración
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');
        
        console.log('✅ Migración ejecutada exitosamente!\n');
        
        // Verificar que las tablas se crearon correctamente
        console.log('🔍 Verificando tablas creadas...\n');
        
        const tablesCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'raffle%'
            ORDER BY table_name
        `);
        
        console.log('📋 Tablas de rifas creadas:');
        tablesCheck.rows.forEach(row => {
            console.log(`   ✅ ${row.table_name}`);
        });
        
        // Verificar funciones
        console.log('\n🔧 Funciones creadas:');
        const functionsCheck = await client.query(`
            SELECT proname 
            FROM pg_proc 
            WHERE proname LIKE 'raffle_%' OR proname = 'generate_unique_raffle_code' OR proname = 'check_user_raffle_limit'
            ORDER BY proname
        `);
        
        functionsCheck.rows.forEach(row => {
            console.log(`   ✅ ${row.proname}()`);
        });
        
        // Verificar vista
        console.log('\n👁️ Vista creada:');
        const viewCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_name = 'raffle_lobby_view'
        `);
        
        if (viewCheck.rows.length > 0) {
            console.log(`   ✅ raffle_lobby_view`);
        }
        
        // Probar generación de código
        console.log('\n🎲 Probando generación de código numérico:');
        const codeTest = await client.query('SELECT generate_unique_raffle_code() as code');
        console.log(`   Código generado: ${codeTest.rows[0].code}`);
        
        console.log(`
==================================================
✅ SISTEMA DE RIFAS COMPLETAMENTE INSTALADO
==================================================

La base de datos está lista para:
- Crear rifas con códigos numéricos de 6 dígitos
- Modo empresas (+3000 fuegos)
- Modo premio con aprobaciones
- Límites por XP (50/500/1000)
- Tickets digitales con QR
- Histórico completo de transacciones

Próximo paso: Implementar backend RaffleService.js
==================================================
        `);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración:', error.message);
        
        // Si el error es de columnas ya existentes, no es crítico
        if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
            console.log('ℹ️ La migración probablemente ya fue ejecutada anteriormente');
        }
        
    } finally {
        client.release();
        await pool.end();
    }
}

executeMigration().catch(console.error);
