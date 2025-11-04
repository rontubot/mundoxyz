const { query, initDatabase, closeDatabase } = require('../db');
const logger = require('../utils/logger');

async function runMigration() {
  try {
    // Inicializar conexión a la base de datos
    await initDatabase();
    logger.info('🚀 Iniciando migración de campos de perfil...');

    // 1. Agregar campos a users
    logger.info('1/5 Agregando columnas nickname y bio a users...');
    await query(`
      ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS nickname VARCHAR(20) UNIQUE,
        ADD COLUMN IF NOT EXISTS bio VARCHAR(500)
    `);
    logger.info('✅ Columnas agregadas');

    // Crear índice
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_nickname 
      ON users(nickname) WHERE nickname IS NOT NULL
    `);
    logger.info('✅ Índice de nickname creado');

    // 2. Crear tabla telegram_link_sessions
    logger.info('2/5 Creando tabla telegram_link_sessions...');
    await query(`
      CREATE TABLE IF NOT EXISTS telegram_link_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        link_token VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Tabla telegram_link_sessions creada');

    // Crear índices
    await query(`CREATE INDEX IF NOT EXISTS idx_telegram_link_token ON telegram_link_sessions(link_token)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_telegram_link_user_id ON telegram_link_sessions(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_telegram_link_expires ON telegram_link_sessions(expires_at) WHERE used = FALSE`);
    logger.info('✅ Índices creados');

    // 3. Crear tabla offensive_words
    logger.info('3/5 Creando tabla offensive_words...');
    await query(`
      CREATE TABLE IF NOT EXISTS offensive_words (
        id SERIAL PRIMARY KEY,
        word VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Tabla offensive_words creada');

    // Crear índice
    await query(`CREATE INDEX IF NOT EXISTS idx_offensive_words_word ON offensive_words(LOWER(word))`);
    logger.info('✅ Índice creado');

    // 4. Insertar palabras ofensivas
    logger.info('4/5 Insertando palabras ofensivas...');
    const words = [
      'mierda', 'joder', 'puta', 'puto', 'marico',
      'marica', 'verga', 'coño', 'carajo', 'maldito',
      'pendejo', 'idiota', 'estupido', 'imbecil', 'burro',
      'mongolico', 'retrasado', 'zorra', 'cabron', 'hijo de puta',
      'hp', 'hijueputa', 'gonorrea', 'malparido'
    ];

    for (const word of words) {
      try {
        await query(`INSERT INTO offensive_words (word) VALUES ($1) ON CONFLICT (word) DO NOTHING`, [word]);
      } catch (err) {
        // Ignorar errores de duplicados
      }
    }
    logger.info(`✅ ${words.length} palabras ofensivas insertadas`);

    // 5. Crear función de limpieza
    logger.info('5/5 Creando función de limpieza...');
    await query(`
      CREATE OR REPLACE FUNCTION clean_expired_telegram_sessions()
      RETURNS void AS $$
      BEGIN
        DELETE FROM telegram_link_sessions
        WHERE expires_at < NOW() - INTERVAL '1 day';
      END;
      $$ LANGUAGE plpgsql
    `);
    logger.info('✅ Función creada');

    // Verificación
    logger.info('🔍 Verificando migración...');
    
    const colsResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('nickname', 'bio')
    `);
    logger.info(`✅ Columnas en users: ${colsResult.rows.map(r => r.column_name).join(', ')}`);

    const sessionsResult = await query(`SELECT COUNT(*) FROM telegram_link_sessions`);
    logger.info(`✅ Sesiones Telegram: ${sessionsResult.rows[0].count}`);

    const wordsResult = await query(`SELECT COUNT(*) FROM offensive_words`);
    logger.info(`✅ Palabras ofensivas: ${wordsResult.rows[0].count}`);

    logger.info('🎉 ¡Migración completada exitosamente!');
    
    // Cerrar conexión
    if (closeDatabase) {
      await closeDatabase();
    }
    
    process.exit(0);

  } catch (error) {
    logger.error('❌ Error en migración:', error);
    
    // Cerrar conexión en caso de error
    if (closeDatabase) {
      await closeDatabase();
    }
    
    process.exit(1);
  }
}

runMigration();
