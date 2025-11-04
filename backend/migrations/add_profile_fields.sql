-- Migración: Agregar campos de perfil y tablas relacionadas
-- Fecha: 2025-01-25

-- 1. Agregar campos a la tabla users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

-- Crear índice para búsqueda rápida de nickname
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) WHERE nickname IS NOT NULL;

-- 2. Crear tabla de sesiones de vinculación Telegram
CREATE TABLE IF NOT EXISTS telegram_link_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para telegram_link_sessions
CREATE INDEX IF NOT EXISTS idx_telegram_link_token ON telegram_link_sessions(link_token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_user_id ON telegram_link_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_expires ON telegram_link_sessions(expires_at) WHERE used = FALSE;

-- 3. Crear tabla de palabras ofensivas
CREATE TABLE IF NOT EXISTS offensive_words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_offensive_words_word ON offensive_words(LOWER(word));

-- 4. Insertar palabras ofensivas iniciales
INSERT INTO offensive_words (word) VALUES
  ('mierda'),
  ('joder'),
  ('puta'),
  ('puto'),
  ('marico'),
  ('marica'),
  ('verga'),
  ('coño'),
  ('carajo'),
  ('maldito'),
  ('pendejo'),
  ('idiota'),
  ('estupido'),
  ('imbecil'),
  ('burro'),
  ('mongolico'),
  ('retrasado'),
  ('zorra'),
  ('cabron'),
  ('hijo de puta'),
  ('hp'),
  ('hijueputa'),
  ('gonorrea'),
  ('malparido'),
  ('hijoemadre')
ON CONFLICT (word) DO NOTHING;

-- 5. Función para limpiar sesiones de Telegram expiradas (opcional)
CREATE OR REPLACE FUNCTION clean_expired_telegram_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM telegram_link_sessions
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON COLUMN users.nickname IS 'Alias único del usuario (máximo 20 caracteres)';
COMMENT ON COLUMN users.bio IS 'Biografía del usuario (máximo 500 caracteres)';
COMMENT ON TABLE telegram_link_sessions IS 'Sesiones temporales para vincular cuentas de Telegram';
COMMENT ON TABLE offensive_words IS 'Lista de palabras no permitidas en nicknames';
