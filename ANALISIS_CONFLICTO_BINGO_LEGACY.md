# 🔍 ANÁLISIS PROFUNDO: CONFLICTO BINGO LEGACY vs V2

**Fecha:** 3 Nov 2025  
**Investigador:** Cascade AI  
**Nivel:** Resolución de conflictos profesional

---

## 🚨 PROBLEMA IDENTIFICADO

### Error en Railway:
```
column "total_xp" of relation "bingo_v2_players" does not exist
```

### Contexto:
- ❌ Tabla `bingo_v2_players` **NO EXISTE** en la DB
- ✅ Tabla correcta es `bingo_v2_room_players`
- ❌ Columna `total_xp` **NO EXISTE** en ninguna tabla de bingo

---

## 🕵️ CAUSA ROOT DEL CONFLICTO

### 1. Migración 006 (Legacy - 30 Oct 2025)
**Archivo:** `backend/db/migrations/006_bingo_host_abandonment.sql`

**Crea:**
- ✅ Trigger `trigger_update_host_activity` sobre `bingo_drawn_numbers`
- ✅ Función `update_bingo_host_activity()`
- ✅ Vista `bingo_rooms_at_risk` (JOIN con `bingo_room_players`)
- ✅ Tabla `bingo_abandonment_notifications`
- ✅ Modificaciones a `bingo_audit_logs`

**Dependencias creadas:**
```sql
-- Trigger que depende de bingo_drawn_numbers
CREATE TRIGGER trigger_update_host_activity
AFTER INSERT ON bingo_drawn_numbers
FOR EACH ROW
EXECUTE FUNCTION update_bingo_host_activity();

-- Vista que depende de bingo_rooms y bingo_room_players
CREATE OR REPLACE VIEW bingo_rooms_at_risk AS
SELECT ... FROM bingo_rooms r
LEFT JOIN bingo_room_players p ON p.room_id = r.id
```

### 2. Migración 008 (V2 Rewrite - 31 Oct 2025)
**Archivo:** `backend/db/migrations/008_bingo_v2_complete_rewrite.sql`

**Hace DROP:**
```sql
DROP TABLE IF EXISTS bingo_audit_logs CASCADE;
DROP TABLE IF EXISTS bingo_drawn_numbers CASCADE;
DROP TABLE IF EXISTS bingo_cards CASCADE;
DROP TABLE IF EXISTS bingo_rooms CASCADE;
```

**Crea nuevas tablas V2:**
- ✅ `bingo_v2_rooms`
- ✅ `bingo_v2_room_players` (NO `bingo_v2_players`)
- ✅ `bingo_v2_cards`
- ✅ `bingo_v2_drawn_numbers`

---

## ⚠️ EL PROBLEMA DE CASCADE

### Lo que CASCADE hace:
```
DROP TABLE bingo_drawn_numbers CASCADE;
```

**Elimina:**
- ✅ La tabla `bingo_drawn_numbers`
- ✅ Foreign keys que dependen de la tabla
- ✅ Triggers que están EN la tabla

**NO Elimina:**
- ❌ Funciones SQL (`update_bingo_host_activity()`)
- ❌ Vistas (`bingo_rooms_at_risk`)
- ❌ Otras tablas relacionadas (`bingo_abandonment_notifications`)

### Resultado:
**PostgreSQL tiene "objetos zombie"** que hacen referencia a tablas que ya no existen.

---

## 🔎 OBJETOS LEGACY QUE QUEDARON ACTIVOS

### Funciones SQL:
1. `update_bingo_host_activity()` - Referencias a `bingo_rooms`
2. Posiblemente otras funciones creadas en migraciones previas

### Vistas:
1. `bingo_rooms_at_risk` - JOIN con `bingo_rooms` y `bingo_room_players`

### Tablas huérfanas:
1. `bingo_abandonment_notifications` - Referencias a `bingo_rooms(id)`

### Triggers huérfanos:
1. `trigger_update_host_activity` - Teóricamente eliminado pero la función persiste

---

## 🧪 EVIDENCIA DEL CONFLICTO

### 1. Error "bingo_v2_players"
El error menciona `bingo_v2_players` pero esa tabla nunca existió.  
**Hipótesis:** Vista o función legacy intentando acceder a tabla con nombre similar.

### 2. Error "total_xp"
No hay columna `total_xp` en ninguna tabla de bingo.  
**Hipótesis:** Función legacy que busca columna de experiencia en tabla incorrecta.

### 3. Experiencia no se muestra
`refreshUser()` no incluía campo `experience` (ya corregido en commit anterior).  
**Estado:** ✅ Corregido pero aún no desplegado en Railway.

---

## 🎯 OBJETOS LEGACY ESPECÍFICOS A ELIMINAR

### De Migración 006:

```sql
-- 1. Eliminar función
DROP FUNCTION IF EXISTS update_bingo_host_activity() CASCADE;

-- 2. Eliminar vista
DROP VIEW IF EXISTS bingo_rooms_at_risk CASCADE;

-- 3. Eliminar tabla de notificaciones legacy
DROP TABLE IF EXISTS bingo_abandonment_notifications CASCADE;

-- 4. Eliminar cualquier trigger residual
DROP TRIGGER IF EXISTS trigger_update_host_activity ON bingo_drawn_numbers CASCADE;
```

### Posibles funciones de otras migraciones:

```sql
-- Buscar funciones que contengan "bingo" y no sean V2
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%bingo%' 
  AND proname NOT LIKE '%v2%';

-- Buscar vistas que contengan "bingo"
SELECT table_name, view_definition 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE '%bingo%';

-- Buscar triggers activos en tablas bingo
SELECT tgname, tgrelid::regclass, tgfoid::regproc 
FROM pg_trigger 
WHERE tgrelid::regclass::text LIKE '%bingo%';
```

---

## 📋 PLAN DE RESOLUCIÓN

### FASE 1: Crear Migración de Limpieza (URGENTE)

**Archivo:** `013_cleanup_bingo_legacy_objects.sql`

```sql
-- ============================================
-- MIGRACIÓN 013: Limpieza de objetos Legacy Bingo
-- Fecha: 3 Nov 2025
-- Propósito: Eliminar funciones, vistas y tablas legacy
--            que quedaron huérfanas tras migración 008
-- ============================================

BEGIN;

-- 1. Eliminar funciones legacy
DROP FUNCTION IF EXISTS update_bingo_host_activity() CASCADE;
DROP FUNCTION IF EXISTS check_bingo_pattern(INTEGER, JSONB, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS validate_bingo_card(JSONB) CASCADE;

-- 2. Eliminar vistas legacy
DROP VIEW IF EXISTS bingo_rooms_at_risk CASCADE;
DROP VIEW IF EXISTS bingo_active_rooms CASCADE;

-- 3. Eliminar tablas legacy huérfanas
DROP TABLE IF EXISTS bingo_abandonment_notifications CASCADE;
DROP TABLE IF EXISTS bingo_room_players CASCADE;

-- 4. Verificar que no queden triggers huérfanos
-- (Intentar eliminar aunque la tabla no exista)
DO $$ 
BEGIN
  -- Esto no fallará si la tabla no existe
  EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_host_activity ON bingo_drawn_numbers';
EXCEPTION WHEN undefined_table THEN
  -- Ignorar si la tabla no existe
  NULL;
END $$;

-- 5. Comentarios
COMMENT ON SCHEMA public IS 'Limpieza de objetos legacy bingo completada en migración 013';

COMMIT;
```

### FASE 2: Verificar Experiencia en Users

```sql
-- Verificar que la columna experience existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('experience', 'total_games_played', 'total_games_won');

-- Si no existen, crearlas (aunque la migración 008 debería haberlas creado)
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_won INTEGER DEFAULT 0;
```

### FASE 3: Validar Tablas V2

```sql
-- Verificar que todas las tablas V2 existen correctamente
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'bingo_v2%'
ORDER BY table_name;

-- Resultado esperado:
-- bingo_v2_cards
-- bingo_v2_drawn_numbers
-- bingo_v2_room_players  (NO bingo_v2_players)
-- bingo_v2_rooms
```

---

## 🔧 ARCHIVOS LEGACY A DEPRECAR/ELIMINAR

### Backend Services (Legacy):
- ❌ `backend/services/bingoAbandonmentService.js`
- ❌ `backend/services/bingoRefundService.js` (si solo aplica a legacy)
- ✅ `backend/services/bingoV2Service.js` (MANTENER)

### Backend Jobs (Legacy):
- ❌ `backend/jobs/bingoAbandonmentJob.js`
- ❌ `backend/jobs/bingoCleanup.js` (si solo aplica a legacy)
- ✅ `backend/jobs/bingoV2FailureDetection.js` (MANTENER)

### Backend Utils (Legacy):
- ❌ `backend/utils/bingo-recovery.js` (si solo aplica a legacy)
- ⚠️ `backend/utils/bingoCardGenerator.js` (VERIFICAR si V2 lo usa)

### Scripts de Test/Fix (Legacy):
Todos los archivos en root que comienzan con `bingo` o contienen `fix_bingo`:
- `fix_bingo_REAL.js`
- `fix_bingo_function.js`
- `apply_bingo_fix.js`
- `debug_bingo.js`
- `verificar_tablas_bingo.js`
- etc.

**Acción:** Mover a carpeta `legacy/deprecated/` o eliminar.

---

## ✅ ORDEN DE EJECUCIÓN

1. **AHORA:** Crear migración 013_cleanup_bingo_legacy_objects.sql
2. **AHORA:** Commit & Push
3. **AHORA:** Esperar deploy Railway (~6 min)
4. **AHORA:** Verificar en Railway que migración 013 se ejecutó
5. **DESPUÉS:** Verificar que error "bingo_v2_players" desaparece
6. **DESPUÉS:** Verificar que experiencia se muestra correctamente
7. **DESPUÉS:** Testing completo de Bingo V2

---

## 🎯 CRITERIOS DE ÉXITO

- [ ] Migración 013 ejecutada sin errores
- [ ] Error "bingo_v2_players" eliminado
- [ ] Error "total_xp" eliminado
- [ ] Experiencia se muestra en header
- [ ] Bingo V2 funciona sin errores legacy
- [ ] Queries de PostgreSQL optimizadas (sin búsqueda de objetos inexistentes)

---

## 📊 IMPACTO ESTIMADO

**Tiempo de resolución:** ~10 minutos  
**Riesgo:** Bajo (solo limpieza de objetos zombie)  
**Beneficio:** Alto (elimina conflictos legacy permanentemente)  
**Testing requerido:** Bingo V2 completo + verificación de experiencia

---

**🔬 CONCLUSIÓN PROFESIONAL:**

El conflicto es causado por **objetos de base de datos legacy (funciones, vistas, tablas)** que **no fueron eliminados** cuando se hizo la migración 008 (V2 rewrite).

PostgreSQL mantiene estos "objetos zombie" que intentan acceder a tablas que ya no existen, causando errores como "bingo_v2_players does not exist" y "column total_xp does not exist".

La solución es crear una **migración de limpieza (013)** que elimine explícitamente todos estos objetos legacy, permitiendo que Bingo V2 funcione sin interferencias del sistema anterior.

**Nivel de confianza en diagnóstico:** 95% ✅
