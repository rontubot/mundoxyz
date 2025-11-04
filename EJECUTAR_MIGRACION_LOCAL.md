# 🚀 EJECUTAR MIGRACIÓN LOCALMENTE

## ⚡ MÉTODO SIMPLE - DESDE TU COMPUTADORA

Ya no necesitas usar Railway Query Editor. Ejecuta la migración directamente desde tu proyecto:

---

## 📋 **INSTRUCCIONES**

### **Opción 1: Migración LOCAL (desarrollo)**

Si estás trabajando en desarrollo local:

```powershell
# Desde la raíz del proyecto
npm run migrate:profile
```

Esto ejecutará las migraciones en tu base de datos local.

---

### **Opción 2: Migración en RAILWAY (producción)**

Para ejecutar en la base de datos de Railway:

#### **Paso 1: Conectar a Railway**

```powershell
# Instalar Railway CLI (solo una vez)
npm install -g @railway/cli

# Login en Railway
railway login

# Vincular proyecto
railway link
```

#### **Paso 2: Ejecutar migración en Railway**

```powershell
# Ejecutar comando en Railway
railway run npm run migrate:profile
```

**Alternativamente**, puedes configurar las variables de entorno de Railway manualmente:

```powershell
# Copia las credenciales de Railway PostgreSQL
$env:PGHOST="containers-us-west-xxx.railway.app"
$env:PGPORT="5432"
$env:PGUSER="postgres"
$env:PGPASSWORD="tu-password"
$env:PGDATABASE="railway"

# Ejecuta la migración
npm run migrate:profile
```

---

## ✅ **QUÉ HACE EL SCRIPT**

El script `migrate-profile-fields.js` hace lo siguiente:

1. ✅ Agrega columnas `nickname` y `bio` a la tabla `users`
2. ✅ Crea índice para búsqueda rápida de nicknames
3. ✅ Crea tabla `telegram_link_sessions` (para vincular Telegram)
4. ✅ Crea tabla `offensive_words` (filtro de palabras)
5. ✅ Inserta 24 palabras ofensivas iniciales
6. ✅ Crea función `clean_expired_telegram_sessions()`
7. ✅ Verifica que todo se creó correctamente

---

## 📝 **SALIDA ESPERADA**

Cuando ejecutes el comando, deberías ver algo como:

```
🚀 Iniciando migración de campos de perfil...
1/5 Agregando columnas nickname y bio a users...
✅ Columnas agregadas
✅ Índice de nickname creado
2/5 Creando tabla telegram_link_sessions...
✅ Tabla telegram_link_sessions creada
✅ Índices creados
3/5 Creando tabla offensive_words...
✅ Tabla offensive_words creada
✅ Índice creado
4/5 Insertando palabras ofensivas...
✅ 24 palabras ofensivas insertadas
5/5 Creando función de limpieza...
✅ Función creada
🔍 Verificando migración...
✅ Columnas en users: nickname, bio
✅ Sesiones Telegram: 0
✅ Palabras ofensivas: 24
🎉 ¡Migración completada exitosamente!
```

---

## ❌ **ERRORES COMUNES**

### **Error: "Cannot find module '../db'"**
**Solución:** Asegúrate de estar en la raíz del proyecto cuando ejecutes el comando.

### **Error: "Connection refused"**
**Solución:** 
- Verifica que las variables de entorno estén configuradas
- Si es local, asegúrate de que PostgreSQL esté corriendo
- Si es Railway, verifica las credenciales

### **Error: "relation already exists"**
**Solución:** Las tablas ya existen. No hay problema, el script maneja esto con `IF NOT EXISTS`.

---

## 🎯 **DESPUÉS DE LA MIGRACIÓN**

Una vez que veas el mensaje "¡Migración completada exitosamente!":

1. ✅ Refresca tu aplicación
2. ✅ Ve a Profile → "Mis Datos"
3. ✅ Prueba guardar cambios
4. ✅ Todo debería funcionar perfectamente

---

## 🔧 **VERIFICACIÓN MANUAL**

Si quieres verificar manualmente que se crearon las tablas:

```powershell
# Conectar a PostgreSQL (local)
psql -U postgres -d mundoxyz

# O conectar a Railway
psql -h [PGHOST] -U postgres -d railway
```

Luego ejecuta:

```sql
-- Ver columnas nuevas
\d users

-- Ver tabla telegram_link_sessions
SELECT COUNT(*) FROM telegram_link_sessions;

-- Ver palabras ofensivas
SELECT COUNT(*) FROM offensive_words;
```

---

## 🚀 **EJECUTA AHORA**

```powershell
npm run migrate:profile
```

¡Y listo! 🎉
