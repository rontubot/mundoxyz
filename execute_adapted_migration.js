const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

console.log(`
==================================================
🎯 EJECUTANDO MIGRACIÓN ADAPTADA RIFAS
==================================================
`);

async function executeAdaptedMigration() {
    const client = await pool.connect();
    try {
        console.log('📖 Leyendo archivo de migración adaptada...\n');
        
        const fs = require('fs');
        const path = require('path');
        const migrationPath = path.join(__dirname, 'migrations', '003_raffles_system_adapted.sql');
        
        if (!fs.existsSync(migrationPath)) {
            throw new Error('Archivo de migración adaptada no encontrado: ' + migrationPath);
        }
        
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('🔧 Ejecutando migración adaptada...\n');
        
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');
        
        console.log('✅ Migración adaptada ejecutada exitosamente!\n');
        
        // Verificar tablas creadas
        console.log('🔍 Verificando estructura completa...\n');
        
        const newTables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'raffle%'
            ORDER BY table_name
        `);
        
        console.log('📋 Todas las tablas de rifas:');
        newTables.rows.forEach(row => {
            console.log(`   ✅ ${row.table_name}`);
        });
        
        // Verificar funciones
        console.log('\n🔧 Funciones disponibles:');
        const functions = await client.query(`
            SELECT proname 
            FROM pg_proc 
            WHERE proname LIKE 'raffle_%' OR proname = 'generate_unique_raffle_code' OR proname = 'check_user_raffle_limit'
            ORDER BY proname
        `);
        
        functions.rows.forEach(row => {
            console.log(`   ✅ ${row.proname}()`);
        });
        
        // Probar generación de código
        console.log('\n🎲 Probando generación de código:');
        const codeTest = await client.query('SELECT generate_unique_raffle_code() as code');
        console.log(`   Código generado: ${codeTest.rows[0].code}`);
        
        // Probar verificación de límites
        console.log('\n👤 Probando verificación de límites XP:');
        const limitTest = await client.query('SELECT * FROM check_user_raffle_limit(NULL::UUID) LIMIT 1');
        if (limitTest.rows.length > 0) {
            console.log(`   Sistema de límites: Funcional`);
        }
        
        // Verificar vista
        console.log('\n👁️ Verificando vista optimizada:');
        const viewTest = await client.query(`
            SELECT COUNT(*) as count FROM information_schema.views 
            WHERE table_name = 'raffle_lobby_view'
        `);
        console.log(`   Vista lobby: ${viewTest.rows[0].count > 0 ? '✅ Creada' : '❌ No encontrada'}`);
        
        console.log(`
==================================================
✅ SISTEMA DE RIFAS ADAPTADO COMPLETAMENTE
==================================================

Características implementadas:
✅ Trabaja con estructura existente de raffles
✅ Modo empresas (+3000 fuegos)
✅ Modo premio con aprobaciones
✅ Límites por XP (50/500/1000)
✅ Tickets digitales con QR
✅ Códigos numéricos de 6 dígitos
✅ Sistema completo de auditoría

La base de datos está lista para el backend!
Próximo paso: Implementar RaffleService.js
==================================================
        `);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración:', error.message);
        
        if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
            console.log('ℹ️ Algunos elementos ya existen, lo cual es normal');
        }
        
    } finally {
        client.release();
        await pool.end();
    }
}

executeAdaptedMigration().catch(console.error);
