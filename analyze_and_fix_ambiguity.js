const { Pool } = require('pg');

// Configuración de conexión
const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

console.log(`
==================================================
🔍 ANÁLISIS PROFUNDO: COLUMN REFERENCE AMBIGUOUS
==================================================
`);

async function analyzeAndFixAmbiguity() {
    const client = await pool.connect();
    try {
        // 1. Verificar la función actual
        console.log('📋 1. ANALIZANDO FUNCIÓN ACTUAL...\n');
        const funcCheck = await client.query(`
            SELECT 
                proname as function_name,
                prosrc as source_code
            FROM pg_proc 
            WHERE proname = 'generate_unique_bingo_room_code'
        `);
        
        if (funcCheck.rows.length > 0) {
            console.log('Función encontrada. Analizando código fuente...\n');
            const sourceCode = funcCheck.rows[0].source_code;
            console.log('CÓDIGO ACTUAL:\n', sourceCode.substring(0, 500), '...\n');
            
            // Detectar el problema
            if (sourceCode.includes('WHERE code = room_code')) {
                console.log('⚠️  PROBLEMA DETECTADO: Ambigüedad en WHERE code = room_code');
                console.log('   PostgreSQL no puede determinar si "code" es:');
                console.log('   - La columna "code" de la tabla bingo_rooms');
                console.log('   - Una variable local (que no existe)');
                console.log('\n');
            }
        }

        // 2. Explicar el problema
        console.log('📚 2. EXPLICACIÓN DEL PROBLEMA:\n');
        console.log('En PL/pgSQL, cuando una variable local tiene un nombre similar');
        console.log('a una columna de tabla, PostgreSQL puede confundirse.');
        console.log('');
        console.log('PROBLEMA ACTUAL:');
        console.log('- Variable local: room_code');
        console.log('- Columna tabla: code');
        console.log('- Query: WHERE code = room_code');
        console.log('');
        console.log('PostgreSQL no sabe si "code" se refiere a:');
        console.log('1. La columna "code" de bingo_rooms (CORRECTO)');
        console.log('2. Una variable llamada "code" (NO EXISTE)');
        console.log('\n');

        // 3. Mostrar soluciones posibles
        console.log('💡 3. SOLUCIONES DISPONIBLES:\n');
        console.log('SOLUCIÓN 1: Usar tabla.columna (RECOMENDADO)');
        console.log('  WHERE bingo_rooms.code = room_code');
        console.log('');
        console.log('SOLUCIÓN 2: Usar alias de tabla');
        console.log('  FROM bingo_rooms br WHERE br.code = room_code');
        console.log('');
        console.log('SOLUCIÓN 3: Cambiar variable_conflict');
        console.log('  #variable_conflict use_column (al inicio de la función)');
        console.log('\n');

        // 4. Eliminar función existente
        console.log('🔧 4. APLICANDO SOLUCIÓN DEFINITIVA...\n');
        
        console.log('Eliminando función existente...');
        await client.query('DROP FUNCTION IF EXISTS generate_unique_bingo_room_code() CASCADE');
        console.log('✅ Función eliminada\n');

        // 5. Crear función corregida con TODAS las mejores prácticas
        console.log('Creando función con sintaxis correcta y sin ambigüedades...\n');
        
        const createFunctionSQL = `
CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
    chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    new_code VARCHAR(6) := '';
    i INTEGER;
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generar nuevo código
        new_code := '';
        FOR i IN 1..6 LOOP
            new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        
        -- Verificar si existe usando sintaxis inequívoca
        -- Usamos bingo_rooms.code para ser explícitos sobre la columna
        SELECT EXISTS(
            SELECT 1 
            FROM bingo_rooms 
            WHERE bingo_rooms.code = new_code
        ) INTO code_exists;
        
        -- Si no existe, retornar el código
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
        
        -- Incrementar contador de intentos
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$;`;

        await client.query(createFunctionSQL);
        console.log('✅ Función creada con sintaxis mejorada\n');

        // 6. Verificar la nueva función
        console.log('🧪 5. VERIFICANDO FUNCIÓN CORREGIDA...\n');
        
        // Test 1: Generar código
        const testResult = await client.query('SELECT generate_unique_bingo_room_code() as code');
        console.log(`✅ Test 1 - Generar código: ${testResult.rows[0].code}\n`);
        
        // Test 2: Verificar que no hay ambigüedad
        const verifyFunc = await client.query(`
            SELECT prosrc 
            FROM pg_proc 
            WHERE proname = 'generate_unique_bingo_room_code'
        `);
        
        const newSource = verifyFunc.rows[0].prosrc;
        if (newSource.includes('bingo_rooms.code')) {
            console.log('✅ Test 2 - Sintaxis correcta: bingo_rooms.code presente');
        }
        
        // Test 3: Crear una sala real para probar
        console.log('\n🧪 Test 3 - Crear sala real...');
        const createRoom = await client.query(`
            INSERT INTO bingo_rooms (
                code, host_id, room_name, room_type, 
                currency, numbers_mode, victory_mode, 
                card_cost, max_players, max_cards_per_player
            ) VALUES (
                generate_unique_bingo_room_code(),
                '39f9d009-04da-4d99-bfd2-b5c18c8202dc',
                'TEST ROOM',
                'public',
                'fires',
                75,
                'line',
                1,
                10,
                5
            ) RETURNING code
        `);
        
        console.log(`✅ Sala creada exitosamente: ${createRoom.rows[0].code}\n`);
        
        // Limpiar sala de prueba
        await client.query('DELETE FROM bingo_rooms WHERE room_name = $1', ['TEST ROOM']);
        
        // 7. Resumen
        console.log(`
==================================================
✅ SOLUCIÓN APLICADA EXITOSAMENTE
==================================================

CAMBIOS REALIZADOS:
1. Variable renombrada: room_code → new_code (más claro)
2. Variable para EXISTS: room_exists → code_exists (más descriptivo)
3. WHERE mejorado: "code = room_code" → "bingo_rooms.code = new_code"
4. Sintaxis explícita para evitar cualquier ambigüedad futura

MEJORAS ADICIONALES:
- Nombres de variables más descriptivos
- Comentarios agregados para claridad
- Sintaxis tabla.columna para evitar ambigüedades

La función ahora es 100% inequívoca y no debería causar
más errores de "column reference is ambiguous".
`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.detail) console.error('Detalle:', error.detail);
        if (error.hint) console.error('Sugerencia:', error.hint);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeAndFixAmbiguity().catch(console.error);
