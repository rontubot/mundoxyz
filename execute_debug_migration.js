const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function debugMigration() {
    const client = await pool.connect();
    try {
        console.log('🔍 DEBUG EJECUCIÓN PASO A PASO\n');
        
        // PASO 1: Verificar estructura actual
        console.log('PASO 1: Verificando estructura actual...');
        const columns = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'raffles' AND column_name = 'status'
        `);
        
        console.log(`¿Columna status existe? ${columns.rows.length > 0 ? 'SÍ' : 'NO'}`);
        if (columns.rows.length > 0) {
            console.log(`   Detalle: ${columns.rows[0].column_name}`);
        }
        
        // PASO 2: Intentar agregar columnas nuevas una por una
        console.log('\nPASO 2: Agregando columnas nuevas individualmente...');
        
        try {
            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT FROM information_schema.columns 
                                  WHERE table_name = 'raffles' AND column_name = 'type') THEN
                        ALTER TABLE raffles ADD COLUMN type VARCHAR(20) DEFAULT 'public';
                        RAISE NOTICE 'Columna type agregada';
                    END IF;
                END $$;
            `);
            console.log('✅ Columna type: OK');
        } catch (e) {
            console.log(`❌ Columna type: ${e.message}`);
        }
        
        try {
            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT FROM information_schema.columns 
                                  WHERE table_name = 'raffles' AND column_name = 'is_company_mode') THEN
                        ALTER TABLE raffles ADD COLUMN is_company_mode BOOLEAN DEFAULT FALSE;
                        RAISE NOTICE 'Columna is_company_mode agregada';
                    END IF;
                END $$;
            `);
            console.log('✅ Columna is_company_mode: OK');
        } catch (e) {
            console.log(`❌ Columna is_company_mode: ${e.message}`);
        }
        
        // PASO 3: Crear tablas nuevas una por una
        console.log('\nPASO 3: Creando tablas nuevas...');
        
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS raffle_companies (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
                    company_name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Tabla raffle_companies: OK');
        } catch (e) {
            console.log(`❌ Tabla raffle_companies: ${e.message}`);
        }
        
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS raffle_numbers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
                    number VARCHAR(10) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'available',
                    purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
                    UNIQUE(raffle_id, number)
                )
            `);
            console.log('✅ Tabla raffle_numbers: OK');
        } catch (e) {
            console.log(`❌ Tabla raffle_numbers: ${e.message}`);
        }
        
        // PASO 4: Crear función simple
        console.log('\nPASO 4: Creando función simple...');
        
        try {
            await client.query(`
                CREATE OR REPLACE FUNCTION generate_unique_raffle_code()
                RETURNS VARCHAR(6)
                LANGUAGE plpgsql
                AS $$
                DECLARE
                    new_code VARCHAR(6);
                BEGIN
                    new_code := CAST(100000 + floor(random() * 900000)::int AS VARCHAR);
                    RETURN new_code;
                END;
                $$;
            `);
            console.log('✅ Función generate_unique_raffle_code: OK');
        } catch (e) {
            console.log(`❌ Función: ${e.message}`);
        }
        
        // PASO 5: Probar función
        console.log('\nPASO 5: Probando función...');
        const test = await client.query('SELECT generate_unique_raffle_code() as code');
        console.log(`✅ Código generado: ${test.rows[0].code}`);
        
        console.log('\n🎯 DEBUG COMPLETADO - SISTEMA PARCIAL FUNCIONAL');
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

debugMigration();
