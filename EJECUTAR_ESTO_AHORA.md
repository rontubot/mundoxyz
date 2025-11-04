# 🚨 EJECUTA ESTO AHORA - TicTacToe NO FUNCIONA

## 🔴 PROBLEMA

Las tablas `tictactoe_rooms`, `tictactoe_moves`, y `tictactoe_stats` **NO EXISTEN** en Railway PostgreSQL.

Por eso al crear una sala de La Vieja, el backend devuelve error 500.

---

## ✅ SOLUCIÓN - 1 COMANDO

### **EJECUTA:**

```powershell
.\ejecutar_migracion.ps1
```

---

## 📋 LO QUE HACE:

1. ✅ Verifica que Node.js esté instalado
2. ✅ Instala driver PostgreSQL `pg` si no existe
3. ✅ Lee `MIGRACION_LA_VIEJA.sql`
4. ✅ Se conecta a Railway PostgreSQL
5. ✅ Crea las 3 tablas necesarias:
   - `tictactoe_rooms`
   - `tictactoe_moves`
   - `tictactoe_stats`
6. ✅ Verifica que las tablas se crearon

---

## ⏱️ TIEMPO ESTIMADO

**~30-60 segundos**

---

## ✅ RESULTADO ESPERADO

```
==================================================
EJECUTANDO MIGRACION LA VIEJA EN RAILWAY
==================================================

Node.js encontrado: v20.x.x
Archivo SQL encontrado

Ejecutando migracion...

==================================================
🚀 EJECUTANDO MIGRACIÓN LA VIEJA EN RAILWAY
==================================================

✓ Archivo SQL encontrado
✓ Contenido SQL cargado
✓ Conectando a Railway PostgreSQL...

✅ Conectado exitosamente a Railway PostgreSQL

📊 Ejecutando migración...

✅ Migración ejecutada exitosamente!

🔍 Verificando tablas creadas...

✅ Tablas creadas:
   - tictactoe_moves
   - tictactoe_rooms
   - tictactoe_stats

==================================================
✅ MIGRACIÓN COMPLETADA EXITOSAMENTE
==================================================

MIGRACION COMPLETADA EXITOSAMENTE

Proximos pasos:
1. Refrescar la pagina web
2. Tu balance de 4.75 fires deberia aparecer
3. Podras crear salas en modo Fires
```

---

## 🎮 DESPUÉS DE LA MIGRACIÓN

### **1️⃣ Recarga la página:**
```
Ctrl + Shift + R
```

### **2️⃣ Intenta crear sala de nuevo:**
- Ir a `/tictactoe/lobby`
- Click en "Crear Sala"
- Seleccionar modo (Coins o Fires)
- Click en "Crear Sala"

### **3️⃣ Debería funcionar:**
✅ Sala creada exitosamente
✅ Te redirige a `/tictactoe/room/XXXXX`
✅ Balance actualizado

---

## ⚠️ SI HAY ERROR

Si el script falla, comparte el mensaje de error conmigo.

Posibles causas:
- ❌ Node.js no instalado
- ❌ Conexión a Railway no disponible
- ❌ Credenciales de Railway cambiaron

---

## 📝 ARCHIVOS INVOLUCRADOS

- ✅ `MIGRACION_LA_VIEJA.sql` - SQL para crear tablas
- ✅ `ejecutar_migracion.js` - Script Node.js
- ✅ `ejecutar_migracion.ps1` - Script PowerShell (este es el que ejecutas)

---

**🚀 EJECUTA `.\ejecutar_migracion.ps1` AHORA Y ESTAREMOS LISTOS!**
