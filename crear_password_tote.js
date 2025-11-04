const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function crearPasswordTote() {
  const client = new Client({
    connectionString: process.argv[2],
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Buscar usuario Tote
    const userQuery = `
      SELECT u.id, u.username
      FROM users u
      WHERE LOWER(u.username) = 'tote'
      LIMIT 1
    `;

    const userResult = await client.query(userQuery);

    if (userResult.rows.length === 0) {
      console.log('❌ Usuario Tote no encontrado');
      return;
    }

    const toteUser = userResult.rows[0];
    console.log(`📊 Usuario encontrado: ${toteUser.username} (${toteUser.id})\n`);

    // Verificar si ya tiene auth_identities
    const checkAuth = await client.query(
      `SELECT id FROM auth_identities WHERE user_id = $1 AND provider = 'email'`,
      [toteUser.id]
    );

    if (checkAuth.rows.length > 0) {
      console.log('⚠️  El usuario ya tiene auth_identities con provider="email"');
      console.log('   ID:', checkAuth.rows[0].id);
      
      // Preguntar si quiere actualizar
      const updateHash = process.argv[3] === '--update';
      if (!updateHash) {
        console.log('\n💡 Para actualizar la contraseña, ejecuta:');
        console.log('   node crear_password_tote.js "connection_string" --update');
        return;
      }
      
      console.log('\n🔄 Actualizando contraseña existente...');
    } else {
      console.log('🔧 Creando nuevo auth_identities para Tote...\n');
    }

    // Contraseña por defecto: 123456
    const password = '123456';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log(`🔐 Password: ${password}`);
    console.log(`🔑 Hash generado (longitud: ${passwordHash.length})\n`);

    if (checkAuth.rows.length > 0) {
      // Actualizar existente
      await client.query(
        `UPDATE auth_identities 
         SET password_hash = $1, updated_at = NOW()
         WHERE user_id = $2 AND provider = 'email'`,
        [passwordHash, toteUser.id]
      );
      console.log('✅ Contraseña actualizada exitosamente');
    } else {
      // Crear nuevo - provider_uid es el email o el user_id como string
      const providerUid = toteUser.id; // Usar el UUID como provider_uid
      
      await client.query(
        `INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash)
         VALUES ($1, 'email', $2, $3)`,
        [toteUser.id, providerUid, passwordHash]
      );
      console.log('✅ Auth_identities creado exitosamente');
    }

    // Verificar
    const verifyQuery = await client.query(
      `SELECT 
         ai.id,
         ai.provider,
         LENGTH(ai.password_hash) AS hash_length
       FROM auth_identities ai
       WHERE ai.user_id = $1 AND ai.provider = 'email'`,
      [toteUser.id]
    );

    console.log('\n📊 VERIFICACIÓN:');
    console.log('─'.repeat(60));
    if (verifyQuery.rows.length > 0) {
      const auth = verifyQuery.rows[0];
      console.log(`✅ Auth ID: ${auth.id}`);
      console.log(`✅ Provider: ${auth.provider}`);
      console.log(`✅ Hash length: ${auth.hash_length}`);
      
      // Verificar que el hash funciona
      const isValid = await bcrypt.compare(password, (await client.query(
        'SELECT password_hash FROM auth_identities WHERE id = $1',
        [auth.id]
      )).rows[0].password_hash);
      
      console.log(`✅ Password verification: ${isValid ? 'CORRECTO ✓' : 'INCORRECTO ✗'}`);
    }
    console.log('─'.repeat(60));

    console.log('\n🎉 LISTO! Ahora el usuario Tote puede:');
    console.log('   • Enviar fuegos usando la contraseña: 123456');
    console.log('   • Aceptar solicitudes de fuegos');
    console.log('   • Realizar transacciones críticas');
    console.log('\n💡 El usuario puede cambiar su contraseña desde "Cambiar Contraseña"');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

// Ejecutar
if (!process.argv[2]) {
  console.log('❌ Falta la URL de conexión');
  console.log('Uso: node crear_password_tote.js "postgresql://..."');
  console.log('     node crear_password_tote.js "postgresql://..." --update');
  process.exit(1);
}

crearPasswordTote();
