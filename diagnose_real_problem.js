/**
 * Diagnóstico REAL del problema - sin asumir nada
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO PROFUNDO DEL PROBLEMA BINGO\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway\n');
    
    // 1. Buscar TODAS las funciones con ese nombre en TODOS los schemas
    console.log('1️⃣ Buscando funciones en TODOS los schemas...');
    const allFunctions = await client.query(`
      SELECT 
        n.nspname as schema,
        p.proname as nombre,
        pg_get_functiondef(p.oid) as definicion_completa
      FROM pg_proc p
      LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'generate_unique_bingo_room_code'
      ORDER BY n.nspname;
    `);
    
    console.log(`📊 Encontradas ${allFunctions.rows.length} función(es):\n`);
    
    allFunctions.rows.forEach((func, idx) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`FUNCIÓN #${idx + 1}`);
      console.log(`Schema: ${func.schema}`);
      console.log(`Nombre: ${func.nombre}`);
      console.log(`\n${func.definicion_completa}`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Verificar si usa 'code' o 'new_code'
      if (func.definicion_completa.includes('new_code')) {
        console.log('✅ Esta función USA new_code (correcto)');
      } else {
        console.log('❌ Esta función USA code (INCORRECTO - causa el error)');
      }
    });
    
    // 2. Ver cuál schema está en el search_path
    console.log('\n2️⃣ Verificando search_path actual...');
    const searchPath = await client.query('SHOW search_path');
    console.log('   Search path:', searchPath.rows[0].search_path);
    
    // 3. Verificar desde qué schema se llama la función cuando hacemos SELECT
    console.log('\n3️⃣ Probando llamar la función sin especificar schema...');
    try {
      const test = await client.query('SELECT generate_unique_bingo_room_code() as code');
      console.log('   ✅ Funcionó, código generado:', test.rows[0].code);
    } catch (err) {
      console.log('   ❌ ERROR:', err.message);
      console.log('   Este es el error que ven los usuarios');
    }
    
    // 4. Intentar desde schema público explícito
    console.log('\n4️⃣ Probando con public.generate_unique_bingo_room_code()...');
    try {
      const test2 = await client.query('SELECT public.generate_unique_bingo_room_code() as code');
      console.log('   ✅ Funcionó, código:', test2.rows[0].code);
    } catch (err) {
      console.log('   ❌ ERROR:', err.message);
    }
    
    // 5. Ver definición exacta de la función que se está usando
    console.log('\n5️⃣ Obteniendo definición de la función actualmente en uso...');
    const currentDef = await client.query(`
      SELECT pg_get_functiondef('generate_unique_bingo_room_code'::regproc) as def
    `);
    console.log('📋 Definición actual:');
    console.log(currentDef.rows[0].def);
    
  } catch (error) {
    console.error('\n❌ ERROR en diagnóstico:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
