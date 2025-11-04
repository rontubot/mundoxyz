-- ============================================
-- MIGRACIÓN: Sistema de Control de Migraciones
-- Versión: 000
-- Fecha: 31 Octubre 2025
-- CRÍTICO: Esta debe ser la PRIMERA migración
-- ============================================

-- Crear tabla de control de migraciones
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_migrations_filename ON migrations(filename);

-- Registrar migraciones ya ejecutadas (basado en existencia de objetos)
-- 001: Si existe tabla users
INSERT INTO migrations (filename) 
SELECT '001_initial_schema.sql'
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'users'
)
ON CONFLICT (filename) DO NOTHING;

-- 002: Si existe tabla bingo_rooms
INSERT INTO migrations (filename) 
SELECT '002_bingo_initial.sql'
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'bingo_rooms'
)
ON CONFLICT (filename) DO NOTHING;

-- 003: Si existe columna last_password_change en users
INSERT INTO migrations (filename) 
SELECT '003_auth_improvements.sql'
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_schema = 'public'
  AND table_name = 'users' 
  AND column_name = 'last_password_change'
)
ON CONFLICT (filename) DO NOTHING;

-- 004: Si existe columna refund_processed en bingo_rooms
INSERT INTO migrations (filename) 
SELECT '004_bingo_updates.sql'
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_schema = 'public'
  AND table_name = 'bingo_rooms' 
  AND column_name = 'refund_processed'
)
ON CONFLICT (filename) DO NOTHING;

-- 005: Si existe columna bingo_mode en bingo_rooms
INSERT INTO migrations (filename) 
SELECT '005_bingo_90_mode.sql'
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_schema = 'public'
  AND table_name = 'bingo_rooms' 
  AND column_name = 'bingo_mode'
)
ON CONFLICT (filename) DO NOTHING;

-- Comentarios de documentación
COMMENT ON TABLE migrations IS 'Control de migraciones ejecutadas en la base de datos';
COMMENT ON COLUMN migrations.filename IS 'Nombre del archivo de migración';
COMMENT ON COLUMN migrations.executed_at IS 'Timestamp de cuando se ejecutó la migración';

-- Vista de estado de migraciones
CREATE OR REPLACE VIEW migration_status AS
SELECT 
  filename,
  executed_at,
  EXTRACT(EPOCH FROM (NOW() - executed_at)) / 86400 as days_ago
FROM migrations
ORDER BY filename;

-- Verificar estado
SELECT 'Tabla de migraciones creada. Migraciones registradas:' as message;
SELECT * FROM migrations ORDER BY filename;
