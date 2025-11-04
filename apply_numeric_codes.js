/**
 * Aplicar cambio a códigos numéricos de 6 dígitos
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

async function applyNumericCodes() {
  console.log('🔢 Aplicando cambio a códigos numéricos...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway\n');
    
    // Aplicar la nueva función
    console.log('1️⃣ Actualizando función...');
    await client.query('DROP FUNCTION IF EXISTS generate_unique_bingo_room_code() CASCADE');
    
    const newFunction = `
CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
    new_code VARCHAR(6);
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    room_exists BOOLEAN;
BEGIN
    LOOP
        -- Generar código de 6 dígitos (000000 a 999999)
        new_code := LPAD(floor(random() * 1000000)::text, 6, '0');
        
        SELECT EXISTS(
            SELECT 1 FROM bingo_rooms WHERE code = new_code
        ) INTO room_exists;
        
        IF NOT room_exists THEN
            RETURN new_code;
        END IF;
        
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
    `;
    
    await client.query(newFunction);
    console.log('✅ Función actualizada\n');
    
    // Probar generación de códigos
    console.log('2️⃣ Probando generación de códigos numéricos...');
    const codes = [];
    
    for (let i = 1; i <= 10; i++) {
      const result = await client.query('SELECT generate_unique_bingo_room_code() as code');
      const code = result.rows[0].code;
      codes.push(code);
      
      // Verificar que sea numérico y de 6 dígitos
      const isNumeric = /^\d{6}$/.test(code);
      console.log(`   ${i}. ${code} ${isNumeric ? '✅' : '❌ NO ES NUMÉRICO'}`);
    }
    
    // Validar todos los códigos
    const allNumeric = codes.every(code => /^\d{6}$/.test(code));
    const allSixDigits = codes.every(code => code.length === 6);
    
    console.log('\n📊 Validación:');
    console.log(`   Todos numéricos: ${allNumeric ? '✅' : '❌'}`);
    console.log(`   Todos 6 dígitos: ${allSixDigits ? '✅' : '❌'}`);
    
    if (allNumeric && allSixDigits) {
      console.log('\n🎉 ¡PERFECTO! Los códigos ahora son numéricos de 6 dígitos');
      console.log('   Ejemplos: 123456, 000789, 987654, etc.');
    } else {
      console.log('\n❌ ERROR: Los códigos no cumplen los requisitos');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

applyNumericCodes()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
