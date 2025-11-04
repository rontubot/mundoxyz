# 🚀 EJECUTAR MIGRACIONES EN RAILWAY

## ⚠️ IMPORTANTE
Las migraciones SQL **NO se ejecutan en PowerShell**. Debes ejecutarlas directamente en la base de datos PostgreSQL de Railway.

---

## 📋 **OPCIÓN 1: Desde Railway Dashboard (MÁS FÁCIL)**

### **Paso 1: Acceder a PostgreSQL**
1. Ve a https://railway.app
2. Abre tu proyecto **mundoxyz**
3. Click en el servicio **PostgreSQL** (el de la base de datos)
4. Click en la pestaña **"Query"** o **"Data"**

### **Paso 2: Copiar y Pegar SQL**
1. Abre el archivo: `backend/migrations/add_profile_fields.sql`
2. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)
3. Pega en el editor de Railway
4. Click en **"Run Query"** o **"Execute"**

### **Paso 3: Verificar**
Deberías ver mensajes como:
```
✅ ALTER TABLE
✅ CREATE INDEX
✅ CREATE TABLE
✅ INSERT 0 24
✅ CREATE FUNCTION
```

---

## 📋 **OPCIÓN 2: Desde psql (Línea de comandos)**

### **Paso 1: Obtener credenciales**
En Railway, click en PostgreSQL y copia las credenciales:
- PGHOST
- PGPORT
- PGUSER
- PGPASSWORD
- PGDATABASE

### **Paso 2: Ejecutar migración**
```bash
psql -h [PGHOST] -p [PGPORT] -U [PGUSER] -d [PGDATABASE] -f backend/migrations/add_profile_fields.sql
```

Ejemplo:
```bash
psql -h containers-us-west-123.railway.app -p 5432 -U postgres -d railway -f backend/migrations/add_profile_fields.sql
```

Te pedirá la contraseña (PGPASSWORD).

---

## 📋 **OPCIÓN 3: SQL Directo (Copia esto)**

Si Railway no te permite subir archivos, copia y pega este SQL completo:

```sql
-- 1. Agregar campos a users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) WHERE nickname IS NOT NULL;

-- 2. Crear tabla telegram_link_sessions
CREATE TABLE IF NOT EXISTS telegram_link_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_token ON telegram_link_sessions(link_token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_user_id ON telegram_link_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_expires ON telegram_link_sessions(expires_at) WHERE used = FALSE;

-- 3. Crear tabla offensive_words
CREATE TABLE IF NOT EXISTS offensive_words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offensive_words_word ON offensive_words(LOWER(word));

-- 4. Insertar palabras ofensivas
INSERT INTO offensive_words (word) VALUES
  ('mierda'),('joder'),('puta'),('puto'),('marico'),
  ('marica'),('verga'),('coño'),('carajo'),('maldito'),
  ('pendejo'),('idiota'),('estupido'),('imbecil'),('burro'),
  ('mongolico'),('retrasado'),('zorra'),('cabron'),('hijo de puta'),
  ('hp'),('hijueputa'),('gonorrea'),('malparido'),('hijoemadre')
ON CONFLICT (word) DO NOTHING;

-- 5. Función para limpiar sesiones
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
```

---

## ✅ **VERIFICAR QUE SE APLICÓ**

Después de ejecutar, verifica con estos queries:

### **1. Verificar columnas en users**
```sql
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('nickname', 'bio');
```

Deberías ver:
```
nickname | character varying | 20
bio      | character varying | 500
```

### **2. Verificar tabla telegram_link_sessions**
```sql
SELECT COUNT(*) FROM telegram_link_sessions;
```

Debería devolver `0` (tabla vacía pero existente)

### **3. Verificar palabras ofensivas**
```sql
SELECT COUNT(*) FROM offensive_words;
```

Debería devolver `24` (o más si agregaste palabras)

---

## 🎯 **DESPUÉS DE LA MIGRACIÓN**

Una vez ejecutada la migración, el modal "Mis Datos" debería funcionar perfectamente:

✅ Guardar nombre para mostrar  
✅ Guardar alias (nickname)  
✅ Guardar biografía  
✅ Cambiar email  
✅ Vincular Telegram  
✅ Filtro de palabras ofensivas  

---

## ❌ **ERRORES COMUNES**

### Error: "relation 'users' does not exist"
**Solución:** Estás en la base de datos incorrecta. Verifica que estás conectado a la BD correcta.

### Error: "permission denied"
**Solución:** Tu usuario no tiene permisos. Usa el usuario `postgres` (admin).

### Error: "column 'nickname' already exists"
**Solución:** Ya ejecutaste la migración antes. No hay problema, ignora el error.

---

## 📞 **¿NECESITAS AYUDA?**

Si tienes problemas:
1. Toma screenshot del error
2. Muéstrame qué método estás usando
3. Te ayudaré paso a paso

---

**¡Ejecuta la migración y vuelve a probar el modal "Mis Datos"!** 🚀
