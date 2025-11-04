# 🔌 CÓMO OBTENER LA URL PÚBLICA DE RAILWAY

## 📍 **UBICACIÓN EN RAILWAY**

### **Opción 1: Connect Tab**

1. **Railway → Tu Proyecto → Postgres**
2. **Click tab "Connect"**
3. **Buscar sección "Available Variables"**
4. **Copiar estos valores:**
   - `PGHOST` (ejemplo: `roundhouse.proxy.rlwy.net`)
   - `PGPORT` (ejemplo: `54321`)
   - `PGUSER` (siempre es `postgres`)
   - `PGPASSWORD` (ejemplo: `jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR`)
   - `PGDATABASE` (siempre es `railway`)

5. **Construir URL:**
   ```
   postgresql://PGUSER:PGPASSWORD@PGHOST:PGPORT/PGDATABASE
   ```

   **Ejemplo:**
   ```
   postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@roundhouse.proxy.rlwy.net:54321/railway
   ```

---

### **Opción 2: Variables Tab**

1. **Railway → Tu Proyecto → Backend Service**
2. **Click tab "Variables"**
3. **Buscar variable `DATABASE_URL`**
4. **Copiar el valor completo**

⚠️ **NOTA:** Esta URL puede ser la interna. Si tiene `.railway.internal`, NO funcionará desde tu PC.

---

### **Opción 3: Settings**

1. **Railway → Postgres → Settings**
2. **Scroll a "Networking"**
3. **Verificar que "Public Networking" esté habilitado**
4. **Copiar el dominio público**

---

## 🔍 **IDENTIFICAR SI LA URL ES CORRECTA**

### ✅ **URL Pública (FUNCIONA desde PC):**
```
postgresql://postgres:PASSWORD@roundhouse.proxy.rlwy.net:PORT/railway
postgresql://postgres:PASSWORD@monorail.proxy.rlwy.net:PORT/railway
postgresql://postgres:PASSWORD@viaduct.proxy.rlwy.net:PORT/railway
```

Características:
- ✅ Tiene `.proxy.rlwy.net`
- ✅ Puerto alto (ej: 54321)
- ✅ Funciona desde cualquier lugar

### ❌ **URL Interna (NO funciona desde PC):**
```
postgresql://postgres:PASSWORD@postgres-7ri0.railway.internal:5432/railway
```

Características:
- ❌ Tiene `.railway.internal`
- ❌ Puerto 5432
- ❌ Solo funciona dentro de Railway

---

## 💡 **SI NO ENCUENTRAS URL PÚBLICA**

Railway puede tener el acceso público deshabilitado. Para habilitarlo:

1. **Railway → Postgres → Settings**
2. **Networking → Public Networking**
3. **Habilitar si está deshabilitado**
4. **Copiar el nuevo dominio/puerto**

---

## 🧪 **PROBAR LA URL**

Una vez tengas la URL correcta, pruébala con:

```powershell
node ejecutar_fix_prueba1.js "TU_URL_AQUI"
```

**Debe conectar y mostrar:**
```
🔌 Conectando a Railway PostgreSQL...
✅ Conectado exitosamente
```

**Si da error:**
```
❌ ERROR: getaddrinfo ENOTFOUND
```

Significa que la URL sigue siendo interna o incorrecta.

---

## 📸 **CAPTURAS DE PANTALLA**

Para ayudarte mejor, envíame una captura de:
1. Railway → Postgres → Tab "Connect"
2. La sección completa de "Available Variables"

Y te diré exactamente qué URL usar.
