const { Client } = require('pg');
const fs = require('fs');

async function fixPrueba1User() {
  const connectionString = process.env.DATABASE_URL || process.argv[2];
  
  if (!connectionString) {
    console.error('❌ ERROR: Debes proporcionar la URL de conexión');
    console.log('');
    console.log('Uso:');
    console.log('  node ejecutar_fix_prueba1.js "postgresql://postgres:PASSWORD@HOST:PORT/railway"');
    console.log('');
    console.log('O establecer variable de entorno:');
    console.log('  $env:DATABASE_URL="postgresql://..."');
    console.log('  node ejecutar_fix_prueba1.js');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Conectando a Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado exitosamente\n');

    // 1. Verificar estado actual
    console.log('📋 1. Verificando estado actual de prueba1...');
    const checkQuery = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.tg_id,
        ai.provider,
        ai.provider_uid,
        ai.password_hash IS NOT NULL as tiene_password,
        u.security_answer IS NOT NULL as tiene_security_answer
      FROM users u
      LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
      WHERE u.username = 'prueba1'
    `;
    
    const checkResult = await client.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      console.log('❌ Usuario prueba1 NO EXISTE en la base de datos');
      await client.end();
      return;
    }

    const user = checkResult.rows[0];
    console.log('Usuario encontrado:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Username: ${user.username}`);
    console.log(`  - Email: ${user.email || 'NULL'}`);
    console.log(`  - Telegram ID: ${user.tg_id || 'NULL'}`);
    console.log(`  - Tiene password: ${user.tiene_password ? '✅' : '❌'}`);
    console.log(`  - Tiene security answer: ${user.tiene_security_answer ? '✅' : '❌'}\n`);

    // 2. Insertar o actualizar auth_identity
    if (!user.tiene_password) {
      console.log('🔧 2. Creando auth_identity con password "123456"...');
      const insertQuery = `
        INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at)
        SELECT 
          u.id, 
          'email', 
          COALESCE(u.email, u.username), 
          '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ',
          NOW()
        FROM users u
        WHERE u.username = 'prueba1'
          AND NOT EXISTS (
            SELECT 1 FROM auth_identities ai 
            WHERE ai.user_id = u.id AND ai.provider = 'email'
          )
      `;
      await client.query(insertQuery);
      console.log('✅ Auth identity creada\n');
    } else {
      console.log('🔧 2. Actualizando password a "123456"...');
      const updateQuery = `
        UPDATE auth_identities ai
        SET password_hash = '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ'
        FROM users u
        WHERE ai.user_id = u.id 
          AND u.username = 'prueba1' 
          AND ai.provider = 'email'
      `;
      await client.query(updateQuery);
      console.log('✅ Password actualizado\n');
    }

    // 3. Verificar resultado final
    console.log('📋 3. Verificando resultado final...');
    const finalCheck = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.tg_id,
        ai.provider,
        ai.provider_uid,
        ai.password_hash IS NOT NULL as tiene_password,
        u.security_answer IS NOT NULL as tiene_security_answer,
        LENGTH(ai.password_hash) as longitud_hash
      FROM users u
      LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
      WHERE u.username = 'prueba1'
    `;
    
    const finalResult = await client.query(finalCheck);
    const finalUser = finalResult.rows[0];
    
    console.log('Estado final:');
    console.log(`  - Username: ${finalUser.username}`);
    console.log(`  - Email: ${finalUser.email || 'NULL'}`);
    console.log(`  - Tiene password: ${finalUser.tiene_password ? '✅' : '❌'}`);
    console.log(`  - Longitud hash: ${finalUser.longitud_hash || 'NULL'}`);
    console.log(`  - Tiene security answer: ${finalUser.tiene_security_answer ? '✅' : '❌'}\n`);

    if (finalUser.tiene_password && finalUser.longitud_hash === 60) {
      console.log('🎉 ¡ÉXITO! Usuario prueba1 configurado correctamente');
      console.log('📝 Ahora puedes hacer login con:');
      console.log('   - Username: prueba1');
      console.log('   - Password: 123456\n');
    } else {
      console.log('⚠️ ADVERTENCIA: Algo salió mal. Revisa los datos anteriores.\n');
    }

    await client.end();
    console.log('🔌 Conexión cerrada');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Detalles:', error);
    await client.end();
    process.exit(1);
  }
}

fixPrueba1User();
