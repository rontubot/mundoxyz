-- ============================================
-- MIGRACIÓN: Fix marked_numbers tipo JSONB
-- Versión: 007
-- Fecha: 31 Octubre 2025
-- CRÍTICO: Convierte marked_numbers de text a JSONB
-- ============================================

-- Verificar y convertir marked_numbers a JSONB si es necesario
DO $$
BEGIN
  -- Solo convertir si no es jsonb
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'bingo_cards' 
    AND column_name = 'marked_numbers' 
    AND data_type != 'jsonb'
  ) THEN
    RAISE NOTICE 'Convirtiendo marked_numbers de % a JSONB', 
      (SELECT data_type FROM information_schema.columns 
       WHERE table_name = 'bingo_cards' AND column_name = 'marked_numbers');
    
    -- Crear columna temporal
    ALTER TABLE bingo_cards ADD COLUMN marked_numbers_temp JSONB;
    
    -- Migrar datos parseando el JSON string
    UPDATE bingo_cards 
    SET marked_numbers_temp = 
      CASE 
        WHEN marked_numbers IS NULL THEN '[]'::jsonb
        WHEN marked_numbers = '' THEN '[]'::jsonb
        WHEN marked_numbers = 'null' THEN '[]'::jsonb
        ELSE 
          -- Intentar parsear como JSON
          CASE 
            WHEN marked_numbers::text ~ '^\[.*\]$' THEN marked_numbers::jsonb
            WHEN marked_numbers::text ~ '^\{.*\}$' THEN marked_numbers::jsonb
            ELSE '[]'::jsonb
          END
      END;
    
    -- Eliminar columna vieja
    ALTER TABLE bingo_cards DROP COLUMN marked_numbers;
    
    -- Renombrar columna nueva
    ALTER TABLE bingo_cards RENAME COLUMN marked_numbers_temp TO marked_numbers;
    
    -- Agregar default
    ALTER TABLE bingo_cards ALTER COLUMN marked_numbers SET DEFAULT '[]'::jsonb;
    
    -- Agregar NOT NULL constraint
    ALTER TABLE bingo_cards ALTER COLUMN marked_numbers SET NOT NULL;
    
    RAISE NOTICE 'marked_numbers convertido a JSONB exitosamente';
  ELSE
    RAISE NOTICE 'marked_numbers ya es JSONB, no se requiere conversión';
  END IF;
END $$;

-- Índice GIN para mejorar performance en búsquedas JSON
CREATE INDEX IF NOT EXISTS idx_bingo_cards_marked_numbers 
ON bingo_cards USING gin(marked_numbers);

-- Índice para búsquedas por room_id y owner_id
CREATE INDEX IF NOT EXISTS idx_bingo_cards_room_owner
ON bingo_cards(room_id, owner_id);

-- Verificación del tipo después de migración
DO $$
DECLARE
  col_type TEXT;
  col_nullable TEXT;
  col_default TEXT;
BEGIN
  SELECT 
    data_type,
    is_nullable,
    column_default 
  INTO 
    col_type,
    col_nullable,
    col_default
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'bingo_cards' 
  AND column_name = 'marked_numbers';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN POST-MIGRACIÓN';
  RAISE NOTICE 'Tipo: %', col_type;
  RAISE NOTICE 'Nullable: %', col_nullable;
  RAISE NOTICE 'Default: %', col_default;
  RAISE NOTICE '========================================';
  
  IF col_type = 'jsonb' THEN
    RAISE NOTICE '✅ Migración exitosa: marked_numbers es JSONB';
  ELSE
    RAISE EXCEPTION '❌ Error: marked_numbers no es JSONB, es %', col_type;
  END IF;
END $$;

-- Limpiar datos corruptos si existen
UPDATE bingo_cards 
SET marked_numbers = '[]'::jsonb
WHERE marked_numbers IS NULL 
   OR marked_numbers::text = 'null'
   OR marked_numbers::text = ''
   OR jsonb_typeof(marked_numbers) != 'array';

-- Estadísticas de la migración
DO $$
DECLARE
  total_cards INTEGER;
  cards_with_marks INTEGER;
  avg_marks NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_cards FROM bingo_cards;
  
  SELECT COUNT(*) INTO cards_with_marks 
  FROM bingo_cards 
  WHERE jsonb_array_length(marked_numbers) > 0;
  
  SELECT AVG(jsonb_array_length(marked_numbers)) INTO avg_marks
  FROM bingo_cards;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ESTADÍSTICAS POST-MIGRACIÓN';
  RAISE NOTICE 'Total cartones: %', total_cards;
  RAISE NOTICE 'Cartones con números marcados: %', cards_with_marks;
  RAISE NOTICE 'Promedio de números marcados: %', COALESCE(avg_marks, 0);
  RAISE NOTICE '========================================';
END $$;

-- Comentarios de documentación
COMMENT ON COLUMN bingo_cards.marked_numbers IS 'Array JSONB de números marcados en el cartón. Ejemplo: [1,2,"FREE",45,67]';

-- ============================================
-- RESUMEN DE CAMBIOS
-- ============================================
-- ✅ marked_numbers convertido de text/varchar a JSONB
-- ✅ Índice GIN para búsquedas eficientes
-- ✅ Valores NULL/corruptos limpiados
-- ✅ Default '[]'::jsonb establecido
-- ✅ Constraint NOT NULL agregado
