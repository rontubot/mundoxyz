const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function executeSafeMigration() {
    const client = await pool.connect();
    try {
        console.log('🔧 Ejecutando migración segura para rifas...\n');
        
        const fs = require('fs');
        const path = require('path');
        const migrationPath = path.join(__dirname, 'migrations', '003_raffles_safe.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');
        
        console.log('✅ Migración segura ejecutada!\n');
        
        // Verificación final
        const tables = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'raffle%'
        `);
        
        console.log(`📊 Tablas de rifas creadas: ${tables.rows[0].count}`);
        
        // Probar funciones
        const codeTest = await client.query('SELECT generate_unique_raffle_code() as code');
        console.log(`🎲 Código de prueba: ${codeTest.rows[0].code}`);
        
        console.log('\n🎯 Base de datos lista para backend RaffleService.js!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

executeSafeMigration();
