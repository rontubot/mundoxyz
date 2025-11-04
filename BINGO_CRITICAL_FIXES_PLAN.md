# 🚨 PLAN CRÍTICO: Sistema de Integridad Financiera Bingo

**Fecha**: 29 de Octubre, 2025  
**Prioridad**: 🔴 CRÍTICA - Involucra dinero real de usuarios  
**Status**: 📋 En Planificación

---

## 🐛 **PROBLEMA CRÍTICO IDENTIFICADO**

### **Pérdida de Dinero de Usuarios:**

```
1. Usuario crea sala de Bingo
   └─> Se descuenta dinero (1-5 Fires/Monedas)
   └─> Sala se guarda en PostgreSQL ✅
   └─> Transacción registrada ✅
   
2. Servidor se reinicia (deploy, crash, etc.)
   └─> Sala queda en status 'lobby' en BD
   └─> Usuario NO puede volver a la sala
   └─> NO hay sistema de recuperación
   └─> Dinero PERDIDO ❌
   
3. Usuario intenta crear nueva sala
   └─> Se le permite (no hay validación)
   └─> Pierde MÁS dinero ❌
```

**GRAVEDAD**: ⚠️ Los usuarios están perdiendo dinero real sin posibilidad de recuperación.

---

## 📊 **ANÁLISIS PROFUNDO**

### **1. ¿Qué Se Guarda Actualmente?**

✅ **SÍ se guarda en PostgreSQL:**
- Sala en `bingo_rooms` (id, code, host_id, status, pot_total, etc.)
- Jugadores en `bingo_room_players` (user_id, cards_owned, ready_at)
- Cartones en `bingo_cards` (owner_id, numbers)
- Transacciones en `wallet_transactions` (monto descontado)
- Transacciones en `bingo_transactions` (histórico)
- Auditoría en `bingo_audit_logs`

❌ **NO se recupera al reiniciar:**
- Salas activas en memoria
- Conexiones Socket.IO de jugadores
- Estado de juego en progreso
- Números cantados

### **2. Estados de una Sala:**

```sql
status ENUM: 'lobby', 'waiting', 'ready', 'playing', 'finished', 'cancelled', 'abandoned'
```

**Flujo Normal:**
```
lobby → waiting → ready → playing → finished
```

**Flujo con Error:**
```
lobby/waiting → (REINICIO) → sala huérfana en BD → dinero perdido
```

### **3. ¿Qué Falta?**

❌ Sistema de recuperación de salas al reiniciar  
❌ Detección de salas abandonadas  
❌ Refund automático de dinero  
❌ Validación de "una sala activa por usuario"  
❌ Sistema de límites por experiencia  
❌ Auto-cantar desbloqueado por nivel  
❌ Timeout de salas inactivas  

---

## 🎯 **REQUERIMIENTOS DEL USUARIO**

### **R1: Persistencia de Salas**
> "No se puede perder la información de los usuarios que están jugando bingo"

**Solución**: Sistema de recuperación automática al reiniciar.

### **R2: Host Persiste Hasta el Final**
> "Cuando un anfitrión crea una sala, se mantiene como anfitrión hasta que la sala termine"

**Solución**: El host puede volver a su sala activa.

### **R3: Una Sala Activa por Usuario**
> "Cada usuario solo puede tener una sala activa (host) hasta que finalice"

**Solución**: Validación antes de crear nueva sala.

### **R4: Límite por Experiencia - 2 Salas**
> "Con 400 XP puede tener 2 salas de bingo activas"

**Solución**: Sistema de límites progresivos.

### **R5: Auto-Cantar por Nivel**
> "Con 300 XP puede activar la función de 'autocantar'"

**Solución**: Feature flag basado en XP.

### **R6: Refund Obligatorio**
> "Si hay fallos debe haber devoluciones totales para los usuarios"

**Solución**: Sistema automático de refund.

---

## 🛠️ **PLAN DE IMPLEMENTACIÓN**

### **FASE 1: Sistema de Recuperación (CRÍTICO)**

#### **1.1 Recuperación al Iniciar Servidor**

**Archivo**: `backend/utils/bingo-recovery.js`

```javascript
/**
 * Sistema de recuperación de salas al reiniciar servidor
 */

async function recoverActiveBingoRooms() {
  try {
    // Obtener salas no finalizadas
    const activeRooms = await query(`
      SELECT * FROM bingo_rooms
      WHERE status IN ('lobby', 'waiting', 'ready', 'playing')
      AND created_at > NOW() - INTERVAL '24 hours'
    `);
    
    for (const room of activeRooms.rows) {
      const timeSinceCreation = Date.now() - new Date(room.created_at);
      const maxIdleTime = 30 * 60 * 1000; // 30 minutos
      
      if (timeSinceCreation > maxIdleTime && room.status !== 'playing') {
        // Sala abandonada - hacer refund
        await refundRoom(room.id, 'abandoned_after_restart');
      } else if (room.status === 'playing') {
        // Sala en juego - marcar para revisión manual
        logger.warn(`Sala ${room.code} estaba en juego al reiniciar`);
        await refundRoom(room.id, 'game_interrupted');
      } else {
        // Sala recuperable - mantenerla activa
        await query(`
          UPDATE bingo_rooms 
          SET last_activity = NOW() 
          WHERE id = $1
        `, [room.id]);
        logger.info(`Sala ${room.code} recuperada`);
      }
    }
  } catch (error) {
    logger.error('Error recovering bingo rooms:', error);
  }
}
```

#### **1.2 Sistema de Refund Automático**

**Archivo**: `backend/services/bingoRefundService.js`

```javascript
/**
 * Servicio de reembolso automático
 */

class BingoRefundService {
  
  /**
   * Reembolsar una sala completa
   */
  static async refundRoom(roomId, reason) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Obtener información de la sala
      const room = await client.query(`
        SELECT * FROM bingo_rooms WHERE id = $1
      `, [roomId]);
      
      if (!room.rows.length) {
        throw new Error('Sala no encontrada');
      }
      
      const roomData = room.rows[0];
      
      // Obtener todos los jugadores con transacciones
      const transactions = await client.query(`
        SELECT 
          user_id,
          SUM(amount) as total_spent
        FROM bingo_transactions
        WHERE room_id = $1 
        AND type IN ('room_creation', 'card_purchase')
        GROUP BY user_id
      `, [roomId]);
      
      // Reembolsar a cada jugador
      for (const tx of transactions.rows) {
        const refundAmount = parseFloat(tx.total_spent);
        
        // Devolver dinero
        await client.query(`
          UPDATE wallets
          SET ${roomData.currency}_balance = ${roomData.currency}_balance + $1
          WHERE user_id = $2
        `, [refundAmount, tx.user_id]);
        
        // Registrar transacción de refund
        await client.query(`
          INSERT INTO wallet_transactions (
            wallet_id, type, currency, amount,
            balance_before, balance_after, description, reference
          ) VALUES (
            (SELECT id FROM wallets WHERE user_id = $1),
            'refund', $2, $3,
            (SELECT ${roomData.currency}_balance - $3 FROM wallets WHERE user_id = $1),
            (SELECT ${roomData.currency}_balance FROM wallets WHERE user_id = $1),
            $4, $5
          )
        `, [
          tx.user_id,
          roomData.currency,
          refundAmount,
          `Reembolso sala Bingo ${roomData.code} - ${reason}`,
          roomData.code
        ]);
        
        logger.info(`Refund ${refundAmount} ${roomData.currency} to user ${tx.user_id}`);
      }
      
      // Marcar sala como cancelada
      await client.query(`
        UPDATE bingo_rooms
        SET status = 'cancelled',
            ended_at = NOW()
        WHERE id = $1
      `, [roomId]);
      
      // Log de auditoría
      await client.query(`
        INSERT INTO bingo_audit_logs (
          room_id, user_id, action, details
        ) VALUES ($1, NULL, 'room_refunded', $2)
      `, [
        roomId,
        JSON.stringify({ reason, transactions: transactions.rows.length })
      ]);
      
      await client.query('COMMIT');
      
      logger.info(`Sala ${roomData.code} reembolsada completamente`);
      return { success: true, refunded: transactions.rows.length };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error refunding room:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Buscar y reembolsar salas abandonadas
   */
  static async refundAbandonedRooms() {
    try {
      const abandonedRooms = await query(`
        SELECT id, code, status, created_at, last_activity
        FROM bingo_rooms
        WHERE status IN ('lobby', 'waiting', 'ready')
        AND last_activity < NOW() - INTERVAL '30 minutes'
        AND created_at > NOW() - INTERVAL '24 hours'
      `);
      
      for (const room of abandonedRooms.rows) {
        await this.refundRoom(room.id, 'abandoned_timeout');
      }
      
      return { refunded: abandonedRooms.rows.length };
    } catch (error) {
      logger.error('Error refunding abandoned rooms:', error);
      throw error;
    }
  }
}
```

---

### **FASE 2: Límites por Usuario (ALTA PRIORIDAD)**

#### **2.1 Validación de Sala Activa**

**Modificar**: `backend/services/bingoService.js` - `createRoom()`

```javascript
// ANTES de crear sala, verificar límites
static async createRoom(hostId, roomData) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // 1. Obtener experiencia del usuario
    const userXP = await client.query(`
      SELECT experience FROM users WHERE id = $1
    `, [hostId]);
    
    const xp = userXP.rows[0]?.experience || 0;
    
    // 2. Determinar límite de salas según XP
    const maxActiveRooms = xp >= 400 ? 2 : 1;
    
    // 3. Contar salas activas del usuario
    const activeRooms = await client.query(`
      SELECT COUNT(*) as count
      FROM bingo_rooms
      WHERE host_id = $1
      AND status IN ('lobby', 'waiting', 'ready', 'playing')
    `, [hostId]);
    
    const currentActiveRooms = parseInt(activeRooms.rows[0].count);
    
    // 4. Validar límite
    if (currentActiveRooms >= maxActiveRooms) {
      throw new Error(
        xp < 400
          ? 'Ya tienes una sala activa. Finalízala antes de crear otra.'
          : 'Ya tienes 2 salas activas (máximo con 400 XP). Finaliza una antes de crear otra.'
      );
    }
    
    // ... resto del código de creación
  }
}
```

#### **2.2 Endpoint para Volver a Sala Activa**

**Nuevo**: `backend/routes/bingo.js`

```javascript
/**
 * GET /api/bingo/my-active-rooms
 * Obtener salas activas del usuario como host
 */
router.get('/my-active-rooms', verifyToken, async (req, res) => {
  try {
    const rooms = await query(`
      SELECT 
        r.*,
        COUNT(DISTINCT p.user_id) as current_players
      FROM bingo_rooms r
      LEFT JOIN bingo_room_players p ON p.room_id = r.id
      WHERE r.host_id = $1
      AND r.status IN ('lobby', 'waiting', 'ready', 'playing')
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `, [req.user.id]);
    
    res.json({ 
      success: true, 
      rooms: rooms.rows,
      canCreateNew: rooms.rows.length < (req.user.experience >= 400 ? 2 : 1)
    });
  } catch (error) {
    logger.error('Error getting active rooms:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### **FASE 3: Auto-Cantar por Experiencia (MEDIA PRIORIDAD)**

#### **3.1 Middleware de Permisos**

**Nuevo**: `backend/middleware/bingoPermissions.js`

```javascript
/**
 * Verificar si el usuario puede usar auto-cantar
 */
function canUseAutoDraw(req, res, next) {
  const userXP = req.user.experience || 0;
  const requiredXP = 300;
  
  if (userXP < requiredXP) {
    return res.status(403).json({
      error: 'Función bloqueada',
      message: `Necesitas ${requiredXP} XP para usar Auto-Cantar. Tienes ${userXP} XP.`,
      requiredXP,
      currentXP: userXP,
      remaining: requiredXP - userXP
    });
  }
  
  next();
}

module.exports = { canUseAutoDraw };
```

#### **3.2 Proteger Endpoint de Auto-Draw**

**Modificar**: `backend/socket/bingoHandler.js`

```javascript
socket.on('bingo:start_auto_draw', async ({ code, interval }) => {
  try {
    const user = socket.user;
    
    // Verificar XP
    if (user.experience < 300) {
      socket.emit('bingo:error', {
        message: 'Necesitas 300 XP para usar Auto-Cantar'
      });
      return;
    }
    
    // ... resto de la lógica
  }
});
```

---

### **FASE 4: Monitoreo y Cleanup (BAJA PRIORIDAD)**

#### **4.1 Cron Job de Limpieza**

**Nuevo**: `backend/jobs/bingoCleanup.js`

```javascript
const cron = require('node-cron');

// Cada 10 minutos
cron.schedule('*/10 * * * *', async () => {
  try {
    // Refund de salas abandonadas
    const result = await BingoRefundService.refundAbandonedRooms();
    logger.info(`Cleanup: ${result.refunded} salas reembolsadas`);
    
    // Limpiar salas muy antiguas (7 días)
    await query(`
      DELETE FROM bingo_rooms
      WHERE status IN ('finished', 'cancelled', 'abandoned')
      AND ended_at < NOW() - INTERVAL '7 days'
    `);
  } catch (error) {
    logger.error('Error in bingo cleanup job:', error);
  }
});
```

---

## 📋 **CHECKLIST DE IMPLEMENTACIÓN**

### **Fase 1 - CRÍTICO (Implementar AHORA):**
- [ ] Crear `bingoRefundService.js`
- [ ] Crear `bingo-recovery.js`
- [ ] Integrar recuperación en `server.js`
- [ ] Agregar endpoint `/my-active-rooms`
- [ ] Agregar validación de límite en `createRoom()`
- [ ] Testing exhaustivo de refunds
- [ ] Deploy a producción con rollback plan

### **Fase 2 - ALTA (1-2 días):**
- [ ] Implementar límites por XP
- [ ] Frontend: Mostrar salas activas
- [ ] Frontend: Bloquear "Crear Sala" si ya tiene activa
- [ ] Notificación al usuario de sala activa

### **Fase 3 - MEDIA (3-4 días):**
- [ ] Middleware de permisos auto-cantar
- [ ] Frontend: Badge de "300 XP para Auto-Cantar"
- [ ] Socket protegido con validación XP

### **Fase 4 - BAJA (1 semana):**
- [ ] Cron job de cleanup
- [ ] Dashboard de monitoreo
- [ ] Alertas de salas problemáticas

---

## 🧪 **TESTING CRÍTICO**

### **Test 1: Refund Básico**
```
1. Usuario crea sala → pierde 1 Fire
2. Simular crash del servidor
3. Ejecutar recovery script
4. Verificar: Usuario recupera 1 Fire ✅
```

### **Test 2: Refund Múltiples Jugadores**
```
1. Host crea sala (1 Fire)
2. Jugador A compra 3 cartones (3 Fires)
3. Jugador B compra 2 cartones (2 Fires)
4. Total pozo: 6 Fires
5. Simular abandono
6. Verificar:
   - Host recupera 1 Fire ✅
   - Jugador A recupera 3 Fires ✅
   - Jugador B recupera 2 Fires ✅
   - Sala status = 'cancelled' ✅
```

### **Test 3: Límite de Salas**
```
1. Usuario con 0 XP crea sala 1 ✅
2. Intenta crear sala 2 → Error ❌
3. Usuario sube a 400 XP
4. Crea sala 2 ✅
5. Intenta crear sala 3 → Error ❌
```

### **Test 4: Auto-Cantar Bloqueado**
```
1. Usuario con 250 XP intenta auto-cantar → Error ❌
2. Usuario sube a 300 XP
3. Intenta auto-cantar → Funciona ✅
```

---

## 📊 **IMPACTO ESPERADO**

| Métrica | Antes | Después |
|---------|-------|---------|
| **Dinero Perdido** | 100% 😢 | 0% (refund automático) ✅ |
| **Salas Huérfanas** | Permanentes | Auto-cleanup ✅ |
| **Múltiples Salas** | Sin límite | 1-2 según XP ✅ |
| **Recuperación** | Imposible | Automática ✅ |
| **Confianza** | Baja ⚠️ | Alta 🎉 |

---

## 🚀 **PRIORIZACIÓN**

### **INMEDIATO (Hoy):**
1. Sistema de refund
2. Recuperación al reiniciar
3. Testing de refunds

### **ESTA SEMANA:**
4. Límites por usuario
5. Endpoint de salas activas
6. Frontend: Volver a sala

### **PRÓXIMA SEMANA:**
7. Auto-cantar por XP
8. Cron jobs de cleanup
9. Monitoring dashboard

---

## ⚠️ **RIESGOS Y MITIGACIONES**

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Refund duplicado | Media | Alto | Transacciones con idempotencia |
| Recovery falla | Baja | Alto | Logs exhaustivos + alertas |
| XP manipulation | Media | Medio | Validación server-side |
| Cron sobrecarga BD | Baja | Medio | Batching + rate limiting |

---

## 📝 **NOTAS FINALES**

1. **Prioridad #1**: NO perder dinero de usuarios
2. **Prioridad #2**: Recuperación automática
3. **Prioridad #3**: UX transparente (mostrar salas activas)
4. **Prioridad #4**: Gamificación (límites por XP)

**ESTE ES UN PROBLEMA CRÍTICO QUE AFECTA LA CONFIANZA DE LOS USUARIOS.**

No podemos lanzar Bingo a producción sin un sistema robusto de refunds.

---

**Documentado por**: Cascade AI  
**Fecha**: 29 de Octubre, 2025  
**Status**: 📋 Pendiente de Implementación  
**Tiempo Estimado**: 1 semana para Fase 1-3
