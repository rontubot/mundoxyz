const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function checkStructure() {
    const client = await pool.connect();
    try {
        console.log('🔍 Verificando estructura actual de tabla raffles...\n');
        
        // Verificar si existe la tabla
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'raffles'
            ) as exists
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ La tabla raffles no existe. Debe crearla primero.');
            
            // Crear tabla básica
            console.log('🔧 Creando tabla raffles básica...\n');
            await client.query(`
                CREATE TABLE raffles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    code VARCHAR(6) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    host_id UUID NOT NULL REFERENCES users(id),
                    cost_per_number INTEGER NOT NULL DEFAULT 10,
                    initial_pot INTEGER DEFAULT 0,
                    current_pot INTEGER DEFAULT 0,
                    total_numbers INTEGER DEFAULT 100,
                    purchased_numbers INTEGER DEFAULT 0,
                    password VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    started_at TIMESTAMP,
                    ended_at TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished', 'cancelled'))
                )
            `);
            console.log('✅ Tabla raffles básica creada');
            
        } else {
            // Verificar columnas existentes
            const columns = await client.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'raffles'
                ORDER BY ordinal_position
            `);
            
            console.log('📋 Columnas actuales en tabla raffles:');
            columns.rows.forEach(col => {
                console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
            });
            
            // Agregar columna status si no existe
            const hasStatus = columns.rows.some(col => col.column_name === 'status');
            if (!hasStatus) {
                console.log('\n🔧 Agregando columna status...');
                await client.query(`
                    ALTER TABLE raffles 
                    ADD COLUMN status VARCHAR(20) DEFAULT 'waiting' 
                    CHECK (status IN ('waiting', 'active', 'finished', 'cancelled'))
                `);
                console.log('✅ Columna status agregada');
            }
        }
        
        console.log('\n🎯 Estructura lista para continuar con migración completa');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkStructure();
