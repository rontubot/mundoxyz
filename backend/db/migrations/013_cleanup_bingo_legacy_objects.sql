-- ============================================
-- MIGRACIÓN 013: Limpieza de objetos Legacy Bingo
-- Fecha: 3 Nov 2025
-- Propósito: Eliminar funciones, vistas y tablas legacy
--            que quedaron huérfanas tras migración 008
-- ============================================
-- PROBLEMA: Objetos de DB legacy (funciones, vistas, triggers)
--           no fueron eliminados con DROP CASCADE en migración 008,
--           causando errores como "bingo_v2_players does not exist"
-- ============================================

BEGIN;

-- ============================================
-- 1. ELIMINAR FUNCIONES LEGACY
-- ============================================

-- Función de migración 006 (host abandonment)
DROP FUNCTION IF EXISTS update_bingo_host_activity() CASCADE;

-- Posibles funciones de validación legacy
DROP FUNCTION IF EXISTS check_bingo_pattern(INTEGER, JSONB, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS validate_bingo_card(JSONB) CASCADE;
DROP FUNCTION IF EXISTS check_user_raffle_limit(UUID) CASCADE;

-- Funciones de generación de código legacy
DROP FUNCTION IF EXISTS generate_bingo_code() CASCADE;
DROP FUNCTION IF EXISTS generate_unique_bingo_code() CASCADE;

-- ============================================
-- 2. ELIMINAR VISTAS LEGACY
-- ============================================

-- Vista de migración 006 (monitoring)
DROP VIEW IF EXISTS bingo_rooms_at_risk CASCADE;

-- Otras posibles vistas legacy
DROP VIEW IF EXISTS bingo_active_rooms CASCADE;
DROP VIEW IF EXISTS bingo_lobby_rooms CASCADE;
DROP VIEW IF EXISTS bingo_player_stats CASCADE;

-- ============================================
-- 3. ELIMINAR TABLAS LEGACY HUÉRFANAS
-- ============================================

-- Tabla de migración 006 (notifications)
DROP TABLE IF EXISTS bingo_abandonment_notifications CASCADE;

-- Tabla legacy de jugadores (si existe)
DROP TABLE IF EXISTS bingo_room_players CASCADE;
DROP TABLE IF EXISTS bingo_players CASCADE;

-- Otras tablas legacy que pudieran existir
DROP TABLE IF EXISTS bingo_chat_messages CASCADE;
DROP TABLE IF EXISTS bingo_player_cards CASCADE;

-- ============================================
-- 4. ELIMINAR TRIGGERS HUÉRFANOS
-- ============================================

-- Intentar eliminar triggers aunque las tablas no existan
DO $$ 
DECLARE
  trigger_record RECORD;
BEGIN
  -- Buscar y eliminar todos los triggers que contienen 'bingo' en su nombre
  -- y no están en tablas bingo_v2
  FOR trigger_record IN 
    SELECT tgname, tgrelid::regclass AS table_name
    FROM pg_trigger
    WHERE tgname LIKE '%bingo%'
      AND tgrelid::regclass::text NOT LIKE 'bingo_v2%'
  LOOP
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s CASCADE', 
                     trigger_record.tgname, 
                     trigger_record.table_name);
      RAISE NOTICE 'Eliminado trigger %: %', trigger_record.tgname, trigger_record.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo eliminar trigger %: %', trigger_record.tgname, SQLERRM;
    END;
  END LOOP;
  
  -- Triggers específicos que sabemos existen
  BEGIN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_host_activity ON bingo_drawn_numbers CASCADE';
  EXCEPTION WHEN undefined_table THEN
    NULL; -- Ignorar si la tabla no existe
  END;
  
END $$;

-- ============================================
-- 5. ELIMINAR ÍNDICES LEGACY HUÉRFANOS
-- ============================================

-- Índices de migración 006
DROP INDEX IF EXISTS idx_bingo_rooms_host_abandoned CASCADE;
DROP INDEX IF EXISTS idx_bingo_rooms_host_activity CASCADE;
DROP INDEX IF EXISTS idx_abandonment_notifications_room CASCADE;
DROP INDEX IF EXISTS idx_abandonment_notifications_status CASCADE;

-- Otros índices legacy conocidos
DROP INDEX IF EXISTS idx_bingo_rooms_status CASCADE;
DROP INDEX IF EXISTS idx_bingo_rooms_code CASCADE;
DROP INDEX IF EXISTS idx_bingo_cards_room CASCADE;
DROP INDEX IF EXISTS idx_bingo_drawn_numbers_room CASCADE;

-- ============================================
-- 6. VERIFICAR COLUMNAS EN USERS
-- ============================================

-- Asegurar que las columnas de experiencia existen
-- (La migración 008 debería haberlas creado, pero verificamos)
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_won INTEGER DEFAULT 0;

-- Crear índice para búsquedas por experiencia
CREATE INDEX IF NOT EXISTS idx_users_experience ON users(experience DESC);

-- ============================================
-- 7. VERIFICACIÓN Y LOGGING
-- ============================================

-- Verificar que solo existen tablas V2
DO $$
DECLARE
  legacy_table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO legacy_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE 'bingo%'
    AND table_name NOT LIKE 'bingo_v2%';
  
  IF legacy_table_count > 0 THEN
    RAISE WARNING 'Aún existen % tablas legacy de bingo', legacy_table_count;
  ELSE
    RAISE NOTICE '✓ No hay tablas legacy de bingo';
  END IF;
END $$;

-- Verificar que existen todas las tablas V2
DO $$
DECLARE
  v2_table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v2_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE 'bingo_v2%';
  
  IF v2_table_count >= 4 THEN
    RAISE NOTICE '✓ Todas las tablas V2 existen (count: %)', v2_table_count;
  ELSE
    RAISE WARNING 'Solo existen % tablas V2 (esperadas: 4)', v2_table_count;
  END IF;
END $$;

-- ============================================
-- 8. COMENTARIOS FINALES
-- ============================================

COMMENT ON COLUMN users.experience IS 'Puntos de experiencia del usuario (otorgados por participar en juegos)';
COMMENT ON COLUMN users.total_games_played IS 'Total de partidas jugadas (TicTacToe, Bingo, etc)';
COMMENT ON COLUMN users.total_games_won IS 'Total de partidas ganadas';

-- Marcar que la limpieza se completó
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'MIGRACIÓN 013 COMPLETADA EXITOSAMENTE';
  RAISE NOTICE 'Limpieza de objetos legacy Bingo finalizada';
  RAISE NOTICE '================================================';
END $$;

COMMIT;

-- ============================================
-- RESUMEN DE CAMBIOS
-- ============================================
-- ✅ Eliminadas funciones legacy (update_bingo_host_activity, etc)
-- ✅ Eliminadas vistas legacy (bingo_rooms_at_risk, etc)
-- ✅ Eliminadas tablas huérfanas (bingo_abandonment_notifications, etc)
-- ✅ Eliminados triggers huérfanos
-- ✅ Eliminados índices huérfanos
-- ✅ Verificadas columnas de experiencia en users
-- ✅ Creado índice para búsquedas por experiencia
-- ✅ Verificación de tablas V2 correctas
-- ============================================
