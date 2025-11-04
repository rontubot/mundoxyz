// Script para debug y fix final de función bingo en Railway PostgreSQL
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de conexión
const connectionString = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

console.log('==================================================');
console.log('🔍 DEBUG FUNCIÓN BINGO EN RAILWAY');
console.log('==================================================\n');

// Crear cliente PostgreSQL
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function debugFunction() {
  try {
    // Conectar
    await client.connect();
    console.log('✅ Conectado exitosamente a Railway PostgreSQL\n');
    
    console.log('🔍 Verificando función actual...\n');
    
    // Verificar función actual
    const functionResult = await client.query(`
      SELECT prosrc 
      FROM pg_proc 
      WHERE proname = 'generate_unique_bingo_room_code'
    `);
    
    if (functionResult.rows.length > 0) {
      console.log('✅ Función encontrada:');
      console.log(functionResult.rows[0].prosrc);
    } else {
      console.log('❌ Función no encontrada');
    }
    
    console.log('\n🛠️ Aplicando fix definitivo...\n');
    
    // Fix definitivo
    const fixSQL = `
      DROP FUNCTION IF EXISTS generate_unique_bingo_room_code();
      
      CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
      RETURNS VARCHAR(6) AS $$
      DECLARE
          chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          code VARCHAR(6) := '';
          i INTEGER;
          max_attempts INTEGER := 100;
          attempt_count INTEGER := 0;
      BEGIN
          LOOP
              code := '';
              FOR i IN 1..6 LOOP
                  code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
              END LOOP;
              
              -- Usar NOT EXISTS sin ambigüedad
              IF NOT EXISTS (SELECT 1 FROM bingo_rooms WHERE code = code) THEN
                  RETURN code;
              END IF;
              
              attempt_count := attempt_count + 1;
              IF attempt_count >= max_attempts THEN
                  RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
              END IF;
          END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(fixSQL);
    console.log('✅ Fix aplicado exitosamente!\n');
    
    // Verificar después del fix
    const verification = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'generate_unique_bingo_room_code'
    `);
    
    if (verification.rows.length > 0) {
      console.log('✅ Función verificada después del fix');
    }
    
    console.log('\n==================================================');
    console.log('✅ DEBUG Y FIX COMPLETADOS');
    console.log('==================================================');
    
  } catch (error) {
    console.error('\n❌ ERROR durante debug/fix:');
    console.error(error.message);
    
    if (error.detail) {
      console.error('\nDetalle:', error.detail);
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Ejecutar
debugFunction();
