const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function diagnoseRaffles() {
    const client = await pool.connect();
    try {
        console.log('🔍 DIAGNÓSTICO COMPLETO TABLA RAFFLES\n');
        
        // 1. Verificar estructura exacta
        const columns = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'raffles'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 ESTRUCTURA EXACTA:');
        columns.rows.forEach(col => {
            console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable})${col.column_default ? ' DEFAULT: ' + col.column_default : ''}`);
        });
        
        // 2. Verificar si status existe con diferente nombre
        const statusCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'raffles' 
            AND column_name LIKE '%status%'
        `);
        
        if (statusCheck.rows.length > 0) {
            console.log('\n✅ Columnas tipo status encontradas:');
            statusCheck.rows.forEach(row => {
                console.log(`   - ${row.column_name}`);
            });
        } else {
            console.log('\n❌ No se encontraron columnas tipo status');
        }
        
        // 3. Verificar valores únicos en la columna que podría ser status
        if (statusCheck.rows.length > 0) {
            const statusCol = statusCheck.rows[0].column_name;
            const values = await client.query(`
                SELECT DISTINCT ${statusCol} as status_value, COUNT(*) as count
                FROM raffles
                GROUP BY ${statusCol}
            `);
            
            console.log(`\n📊 Valores en ${statusCol}:`);
            values.rows.forEach(row => {
                console.log(`   ${row.status_value}: ${row.count} registros`);
            });
        }
        
        // 4. Verificar datos existentes
        const dataCount = await client.query('SELECT COUNT(*) as total FROM raffles');
        console.log(`\n📈 Total rifas existentes: ${dataCount.rows[0].total}`);
        
        // 5. Crear migración mínima para agregar status si no existe
        const hasStatusColumn = columns.rows.some(col => col.column_name === 'status');
        if (!hasStatusColumn) {
            console.log('\n🔧 Creando migración para agregar columna status...');
            await client.query(`
                ALTER TABLE raffles 
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'waiting'
            `);
            console.log('✅ Columna status agregada exitosamente');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

diagnoseRaffles();
