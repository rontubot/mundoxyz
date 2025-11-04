# ✅ ESPECIFICACIONES FINALES: "LA VIEJA" (TIC-TAC-TOE)

**Fecha:** 25 de Octubre, 2025  
**Versión:** 2.0 - CORREGIDA  
**Estado:** ✅ Aprobada y lista para implementar

---

## 🎯 ESPECIFICACIONES TÉCNICAS

| Característica | Valor |
|----------------|-------|
| **Jugadores** | 2 (1v1) |
| **Duración por Turno** | **15 segundos** (timer automático) |
| **Modos Disponibles** | **Coins** y **Fires** (NO hay modo amistoso) |
| **Apuesta Mínima (Coins)** | **1 Coin** |
| **Apuesta Máxima (Coins)** | **1,000 Coins** |
| **Apuesta Fires** | **Fijo 1 Fire** (no editable) |
| **Comisión de la Casa** | **0% - Sin comisión** |
| **Premio al Ganador** | **100% del pot total** |
| **En caso de Empate** | **50% cada jugador** |
| **XP por Partida** | **1 XP a ambos jugadores** |
| **Sistema de Revancha** | **Infinitas revanchas** (ambos deben aceptar) |

---

## 💰 ECONOMÍA

### Modo Coins

**Rango de apuestas:** Desde 1 hasta 1,000 Coins

**Ejemplo 1: Apuesta mínima**
```
Jugador X apuesta: 1 Coin
Jugador O apuesta: 1 Coin
──────────────────────
Pot Total: 2 Coins
Ganador recibe: 2 Coins (100%)
```

**Ejemplo 2: Apuesta estándar**
```
Jugador X apuesta: 100 Coins
Jugador O apuesta: 100 Coins
──────────────────────
Pot Total: 200 Coins
Ganador recibe: 200 Coins (100%)
```

**Ejemplo 3: Empate**
```
Jugador X apuesta: 50 Coins
Jugador O apuesta: 50 Coins
──────────────────────
Pot Total: 100 Coins
Cada jugador recupera: 50 Coins (50% c/u)
```

### Modo Fires

**Apuesta fija:** 1 Fire (no se puede modificar)

**Ejemplo: Partida Fires**
```
Jugador X apuesta: 1 Fire (fijo)
Jugador O apuesta: 1 Fire (fijo)
──────────────────────
Pot Total: 2 Fires
Ganador recibe: 2 Fires (100%)
```

**Ejemplo: Empate Fires**
```
Jugador X apuesta: 1 Fire
Jugador O apuesta: 1 Fire
──────────────────────
Pot Total: 2 Fires
Cada jugador recupera: 1 Fire (50% c/u)
```

---

## ⏱️ SISTEMA DE TIMER

### Características del Timer

- **Duración:** 15 segundos por turno
- **Inicio:** Al comenzar cada turno (después del movimiento anterior)
- **Reset:** Se reinicia a 15 seg tras cada movimiento válido
- **Countdown visible:** Mostrar segundos restantes en UI

### Lógica de Timeout

**Si el tiempo se agota:**
```javascript
// El jugador que NO hizo su movimiento a tiempo pierde automáticamente
if (timeLeft === 0) {
  const loser = currentTurn === 'X' ? player_x_id : player_o_id;
  const winner = currentTurn === 'X' ? player_o_id : player_x_id;
  
  // Finalizar juego
  await finishGameByTimeout(roomId, winnerId, loserId);
  
  // Distribuir premio completo al ganador
  await distributePrizes(room, winnerId);
  
  // Otorgar XP a ambos
  await awardXP(room);
}
```

**Eventos WebSocket:**
```javascript
socket.emit('room:timer-tick', { timeLeft: 14 });
socket.emit('room:timeout', { loser: player_x_id, winner: player_o_id });
```

---

## 🗄️ BASE DE DATOS

### Campos Clave de `tictactoe_rooms`

```sql
-- Configuración
mode VARCHAR(20) CHECK (mode IN ('coins', 'fires'))  -- Solo 2 modos
bet_amount NUMERIC(10,2) DEFAULT 1 CHECK (bet_amount >= 1)

-- Timer
time_left_seconds INTEGER DEFAULT 15 CHECK (0 <= time_left_seconds <= 15)
last_move_at TIMESTAMP

-- Economía (sin comisión)
pot_coins NUMERIC(10,2) DEFAULT 0
pot_fires NUMERIC(10,2) DEFAULT 0
prize_coins NUMERIC(10,2) DEFAULT 0  -- 100% al ganador
prize_fires NUMERIC(10,2) DEFAULT 0  -- 100% al ganador

-- Constraints
CONSTRAINT valid_bet CHECK (
  (mode = 'coins' AND bet_amount >= 1 AND bet_amount <= 1000) OR
  (mode = 'fires' AND bet_amount = 1)
)
```

---

## 🔧 VALIDACIONES BACKEND

### Al Crear Sala

```javascript
// POST /api/tictactoe/create
if (!['coins', 'fires'].includes(mode)) {
  return res.status(400).json({ error: 'Modo inválido. Solo "coins" o "fires"' });
}

if (mode === 'coins') {
  if (betAmount < 1 || betAmount > 1000) {
    return res.status(400).json({ error: 'Apuesta coins debe ser entre 1-1000' });
  }
} else if (mode === 'fires') {
  if (betAmount !== 1) {
    return res.status(400).json({ error: 'Apuesta fires debe ser fijo 1' });
  }
}

// Verificar balance
const currency = mode;
const userBalance = await getBalance(userId, currency);

if (userBalance < betAmount) {
  return res.status(400).json({ 
    error: `Balance insuficiente. Tienes ${userBalance} ${currency}, necesitas ${betAmount}` 
  });
}
```

### Al Hacer Movimiento

```javascript
// POST /api/tictactoe/room/:code/move
const room = await getRoom(code);

// Verificar turno
if (currentTurn !== playerSymbol) {
  return res.status(400).json({ error: 'No es tu turno' });
}

// Verificar timer
const timeSinceLastMove = Date.now() - room.last_move_at;
if (timeSinceLastMove > 15000) {
  // Timeout automático
  await handleTimeout(room);
  return res.status(400).json({ error: 'Tiempo agotado' });
}

// Procesar movimiento y resetear timer
await updateRoom(room.id, {
  time_left_seconds: 15,
  last_move_at: new Date()
});
```

---

## 🎨 UI/UX FRONTEND

### Modal Crear Sala

```jsx
<CreateRoomModal>
  <h2>Crear Sala - La Vieja</h2>
  
  {/* Selector de Modo */}
  <div className="mode-selector">
    <button 
      className={mode === 'coins' ? 'active' : ''}
      onClick={() => setMode('coins')}
    >
      🪙 Coins
    </button>
    <button 
      className={mode === 'fires' ? 'active' : ''}
      onClick={() => setMode('fires')}
    >
      🔥 Fires
    </button>
  </div>
  
  {/* Input de Apuesta */}
  {mode === 'coins' ? (
    <div className="bet-input">
      <label>Apuesta (1-1000 Coins)</label>
      <input 
        type="number" 
        min={1} 
        max={1000}
        value={betAmount}
        onChange={(e) => setBetAmount(e.target.value)}
      />
      <span className="balance">Balance: {userCoins} 🪙</span>
    </div>
  ) : (
    <div className="bet-fixed">
      <label>Apuesta Fija</label>
      <div className="fire-badge">🔥 1 Fire</div>
      <span className="balance">Balance: {userFires} 🔥</span>
    </div>
  )}
  
  {/* Visibilidad */}
  <div className="visibility-toggle">
    <label>Visibilidad</label>
    <Toggle 
      value={visibility}
      options={['public', 'private']}
      onChange={setVisibility}
    />
  </div>
  
  <button className="btn-primary" onClick={handleCreate}>
    Crear Sala
  </button>
</CreateRoomModal>
```

### Timer en Partida

```jsx
<div className="game-header">
  <div className="room-info">
    <span className="code">Sala: {code}</span>
    <span className="mode">
      {mode === 'coins' ? `🪙 ${betAmount} Coins` : '🔥 1 Fire'}
    </span>
  </div>
  
  {/* Timer prominente */}
  <div className={`timer ${timeLeft <= 5 ? 'urgent' : ''}`}>
    <div className="timer-circle">
      <svg viewBox="0 0 100 100">
        <circle 
          cx="50" cy="50" r="45"
          stroke="#333"
          strokeWidth="10"
          fill="none"
        />
        <circle 
          cx="50" cy="50" r="45"
          stroke="#22d3ee"
          strokeWidth="10"
          fill="none"
          strokeDasharray={`${(timeLeft / 15) * 283} 283`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="timer-number">{timeLeft}s</span>
    </div>
    {isMyTurn && <span className="timer-label">Tu turno</span>}
  </div>
  
  <div className="pot">
    Premio: {pot} {mode === 'coins' ? '🪙' : '🔥'}
  </div>
</div>
```

### Animación de Timeout

```jsx
// Cuando el timer llega a 0
<motion.div
  className="timeout-overlay"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
>
  <div className="timeout-message">
    <AlertTriangle size={64} />
    <h2>¡Tiempo Agotado!</h2>
    <p>{loserName} no hizo su movimiento a tiempo</p>
    <p className="winner">
      {winnerName} gana por timeout
    </p>
  </div>
</motion.div>
```

---

## 📊 FLUJO DE JUEGO COMPLETO

```
1. Usuario abre modal "Crear Sala"
   ├─ Selecciona modo: Coins o Fires
   ├─ Si Coins: elige apuesta (1-1000)
   ├─ Si Fires: apuesta fija 1 Fire
   └─ Elige visibilidad (pública/privada)

2. Sistema valida balance y crea sala
   └─ Deducir apuesta del host inmediatamente

3. Jugador 2 se une a la sala
   ├─ Sistema valida su balance
   └─ Deducir apuesta del jugador 2

4. Ambos jugadores marcan "Listo"
   └─ Juego inicia automáticamente

5. Partida en curso (X comienza)
   ├─ Timer: 15 segundos por turno
   ├─ Click en casilla → movimiento registrado
   ├─ Timer resetea a 15 seg
   └─ Turno pasa al otro jugador

6. Condiciones de finalización:
   a) Victoria: 3 en raya
      └─ Ganador recibe 100% del pot
   
   b) Empate: Tablero lleno sin ganador
      └─ Cada uno recupera 50% del pot
   
   c) Timeout: No juega en 15 seg
      └─ Pierde automáticamente, rival gana 100%

7. Al finalizar:
   ├─ Distribuir premios (sin comisión)
   ├─ Otorgar 1 XP a ambos jugadores
   ├─ Actualizar estadísticas
   └─ Mostrar modal de resultado
```

---

## ✅ CAMBIOS vs VERSIÓN ANTERIOR

| Aspecto | Anterior | **NUEVO** |
|---------|----------|-----------|
| **Modos** | 3 (Amistoso, Coins, Fires) | **2 (Coins, Fires)** |
| **Apuesta Coins Min** | 10 | **1** |
| **Apuesta Fires** | 10-1000 | **Fijo 1** |
| **Comisión** | 10% | **0%** |
| **Premio Ganador** | 90% del pot | **100% del pot** |
| **Empate** | 45% c/u | **50% c/u** |
| **Timer** | No especificado | **15 seg por turno** |

---

## 📝 ARCHIVOS ACTUALIZADOS

✅ `RESUMEN_LA_VIEJA.md` - Resumen ejecutivo corregido  
✅ `MIGRACION_LA_VIEJA.sql` - Script SQL actualizado  
✅ `ESPECIFICACIONES_LA_VIEJA_FINAL.md` - Este documento

**Commit:** `a8a79b1` - "fix: La Vieja - 2 modos solo, Coins 1-1000, Fires fijo 1, sin comision, timer 15seg"

---

## 🚀 LISTO PARA IMPLEMENTAR

Todas las especificaciones están actualizadas y committeadas. El sistema está diseñado para:

✅ **Economía justa** → Sin comisión, 100% al ganador  
✅ **Accesible** → Apuestas desde 1 Coin  
✅ **Fires simplificado** → Fijo en 1 Fire  
✅ **Partidas dinámicas** → Timer de 15 seg por turno  
✅ **XP integrado** → 1 XP por participar  

**¿Procedo con la implementación del código?** 🚀
