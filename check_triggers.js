const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function checkTriggers() {
    const client = await pool.connect();
    try {
        console.log('🔍 Verificando triggers en bingo_rooms...\n');
        
        // Verificar triggers
        const triggers = await client.query(`
            SELECT 
                tgname as trigger_name,
                proname as function_name
            FROM pg_trigger t
            JOIN pg_proc p ON p.oid = t.tgfoid
            WHERE t.tgrelid = 'bingo_rooms'::regclass
        `);
        
        if (triggers.rows.length > 0) {
            console.log('Triggers encontrados:');
            for (const trigger of triggers.rows) {
                console.log(`- ${trigger.trigger_name} -> ${trigger.function_name}`);
                
                // Obtener el código de la función del trigger
                const funcCode = await client.query(`
                    SELECT prosrc 
                    FROM pg_proc 
                    WHERE proname = $1
                `, [trigger.function_name]);
                
                if (funcCode.rows.length > 0) {
                    const code = funcCode.rows[0].prosrc;
                    // Buscar referencias a "code" sin prefijo
                    if (code.includes('WHERE code') || code.includes('= code') || code.includes('code =')) {
                        console.log(`  ⚠️ POSIBLE PROBLEMA: Referencia a 'code' encontrada`);
                        console.log(`  Código relevante:`);
                        console.log(code.substring(0, 500));
                    }
                }
            }
        } else {
            console.log('No hay triggers en bingo_rooms');
        }
        
        // También verificar la función generate_unique_bingo_room_code
        console.log('\n🔍 Verificando función generate_unique_bingo_room_code...\n');
        const funcCheck = await client.query(`
            SELECT prosrc 
            FROM pg_proc 
            WHERE proname = 'generate_unique_bingo_room_code'
        `);
        
        if (funcCheck.rows.length > 0) {
            const code = funcCheck.rows[0].prosrc;
            // Buscar el WHERE específico
            const whereMatch = code.match(/WHERE.*code.*=/gi);
            if (whereMatch) {
                console.log('WHERE encontrado en función:');
                whereMatch.forEach(match => {
                    console.log(`  ${match}`);
                    if (!match.includes('bingo_rooms.code')) {
                        console.log('  ⚠️ PROBLEMA: No usa prefijo bingo_rooms.code');
                    } else {
                        console.log('  ✅ OK: Usa prefijo bingo_rooms.code');
                    }
                });
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkTriggers();
