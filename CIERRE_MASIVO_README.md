# 🚀 EJECUTAR CIERRE MASIVO AHORA

## ⚡ MÉTODO RÁPIDO (3 minutos)

### 1️⃣ Ir a Railway
```
https://railway.app → Tu Proyecto → PostgreSQL → Query
```

### 2️⃣ Copiar PASO 1 de `EXECUTE_REFUND_NOW.sql`
Solo las líneas del PASO 1 (líneas 8-28) - **NO modifica nada**, solo muestra lo que se va a cerrar

### 3️⃣ Revisar Output
Verás algo como:
```
Código | Estado | Host | Jugadores | A Reembolsar
306192 | waiting | prueba1 | 1 | 5.00
139105 | waiting | prueba1 | 1 | 6.00
...
```

### 4️⃣ Copiar PASO 2 de `EXECUTE_REFUND_NOW.sql`
Todo desde `BEGIN;` hasta antes de `COMMIT;` (líneas 30-115)

### 5️⃣ Ejecutar y Revisar Resumen
Verás:
```
Salas Cerradas | Jugadores Reembolsados | Total Fires
8              | 8                       | 38.00
```

### 6️⃣ Si todo está bien:
```sql
COMMIT;
```

### 6️⃣ Si algo está mal:
```sql
ROLLBACK;
```

---

## 📊 SALAS QUE SE VAN A CERRAR

Según análisis Chrome DevTools:

| Código | Estado | Jugadores | Reembolso |
|--------|--------|-----------|-----------|
| 306192 | waiting | 1 | 5.00 fires |
| 139105 | waiting | 1 | 6.00 fires |
| 955284 | in_progress | 1 | 6.00 fires |
| 387734 | in_progress | 1 | 6.00 fires |
| 451836 | in_progress | 1 | 6.00 fires |
| 162908 | in_progress | 1 | 2.00 fires |
| 120307 | in_progress | 1 | 3.00 fires |
| 493974 | in_progress | 1 | 5.00 fires |

**Total**: ~38 fires a reembolsar

---

## ✅ QUÉ HACE EL SCRIPT

1. ✅ Reembolsa a cada jugador su gasto en wallets
2. ✅ Registra cada reembolso en `bingo_v2_refunds`
3. ✅ Envía mensaje al buzón de cada jugador
4. ✅ Marca salas como `cancelled`
5. ✅ Registra en audit logs
6. ✅ Todo en UNA transacción (ROLLBACK si falla)

---

## 🔍 VERIFICAR DESPUÉS

```sql
-- Ver salas cerradas
SELECT code, status FROM bingo_v2_rooms 
WHERE finished_at >= NOW() - INTERVAL '5 minutes';

-- Ver reembolsos
SELECT COUNT(*), SUM(amount) FROM bingo_v2_refunds 
WHERE refunded_at >= NOW() - INTERVAL '5 minutes';

-- Ver balance prueba1
SELECT u.username, w.fires_balance 
FROM users u 
JOIN wallets w ON u.id = w.user_id 
WHERE u.username = 'prueba1';
```

---

## 📁 ARCHIVOS DISPONIBLES

1. **EXECUTE_REFUND_NOW.sql** ← **USAR ESTE**
   - Copiar y pegar directamente en Railway
   - Paso a paso con seguridad

2. **refund-all-rooms.sql**
   - Versión más detallada
   - Mismo resultado

3. **refund-all-active-rooms.js**
   - Si prefieres Node.js
   - Requiere configurar DATABASE_URL

4. **REFUND_ALL_ROOMS_INSTRUCTIONS.md**
   - Documentación completa

---

## ⏱️ TIEMPO ESTIMADO

- Abrir Railway: 30 segundos
- Copiar PASO 1: 10 segundos  
- Revisar output: 30 segundos
- Copiar PASO 2: 10 segundos
- Ejecutar y revisar: 1 minuto
- COMMIT: 10 segundos

**Total: ~3 minutos** ⚡

---

## 🆘 SI ALGO FALLA

1. NO ENTRES EN PÁNICO
2. Ejecuta `ROLLBACK;`
3. Todo volverá al estado anterior
4. Railway tiene backups automáticos

---

**Listo para ejecutar** ✅
