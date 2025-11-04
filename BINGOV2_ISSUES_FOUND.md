# PROBLEMAS ENCONTRADOS EN BINGO V2 - 2 NOV 2025

## 1. ⚠️ SINCRONIZACIÓN FRONTEND-BACKEND

### PROBLEMA:
El componente `BingoV2Card` mantiene estado local de posiciones marcadas que NO se sincroniza correctamente con el backend.

### EVIDENCIA:
- Frontend muestra 16 celdas marcadas con columna N completa
- Backend rechaza BINGO: "El patrón aún no está completo"
- Las posiciones marcadas localmente no se guardan consistentemente en la base de datos

### CAUSA ROOT:
1. `BingoV2Card` usa `useState` local para `markedPositions`
2. Cuando se hace clic, actualiza estado local inmediatamente
3. Emite evento socket `bingo:mark_number` de forma asíncrona
4. No hay confirmación de que el backend guardó la posición
5. No hay sincronización al reconectar socket

### ARQUITECTURA ACTUAL:
```
Frontend (BingoV2Card):
  - markedPositions (useState local) ← ❌ Fuente de verdad incorrecta
  - handleCellClick → setMarkedPositions → onMarkNumber
  
Backend (socket):
  - bingo:mark_number → BingoV2Service.markNumber
  - Guarda en bingo_v2_cards.marked_positions ← ✅ Fuente de verdad correcta
```

### SOLUCIÓN PROPUESTA:
**Opción A**: Backend como fuente de verdad
- Emitir evento `bingo:mark_number`
- Esperar confirmación del backend
- Solo entonces actualizar UI local
- Cargar marked_positions desde backend al montar componente

**Opción B**: Optimistic UI con reconciliación
- Actualizar UI inmediatamente (optimistic)
- Enviar al backend
- Reconciliar si falla o difiere

## 2. ⚠️ FALTA CARGA INICIAL DE MARKED_POSITIONS

### PROBLEMA:
Al cargar BingoV2GameRoom, los cartones NO muestran las posiciones previamente marcadas si el jugador recarga la página.

### EVIDENCIA:
El componente `BingoV2Card` inicializa `markedPositions` como `new Set()` vacío sin cargar desde `card.marked_positions`.

### CÓDIGO ACTUAL:
```javascript
// BingoV2Card.js línea 13
const [markedPositions, setMarkedPositions] = useState(new Set());
```

### SOLUCIÓN:
```javascript
const [markedPositions, setMarkedPositions] = useState(() => {
  const initialMarked = new Set();
  if (card?.marked_positions) {
    card.marked_positions.forEach(pos => {
      initialMarked.add(`${pos.row},${pos.col}`);
    });
  }
  return initialMarked;
});

// Actualizar cuando cambie el cartón
useEffect(() => {
  if (card?.marked_positions) {
    const newMarked = new Set();
    card.marked_positions.forEach(pos => {
      newMarked.add(`${pos.row},${pos.col}`);
    });
    setMarkedPositions(newMarked);
  }
}, [card]);
```

## 3. ⚠️ VALIDACIÓN DE PATRÓN DESINCRONIZADA

### PROBLEMA:
La función `checkPatternComplete` en BingoV2GameRoom valida usando `card.marked_positions` local, pero el backend valida usando lo que tiene en la base de datos.

### IMPACTO:
- Frontend activa `canCallBingo = true`
- Usuario hace clic en botón BINGO
- Backend rechaza porque sus datos difieren

### SOLUCIÓN:
Implementar confirmación desde backend al marcar números y mantener sincronizado el estado.

## 4. ⚠️ FALTA MANEJO DE ERRORES EN MARCADO

### PROBLEMA:
Si `bingo:mark_number` falla en el backend, el frontend no lo detecta ni revierte el cambio.

### CÓDIGO ACTUAL:
```javascript
// BingoV2GameRoom.js línea 169-197
const handleMarkNumber = (cardId, position) => {
  if (socket) {
    socket.emit('bingo:mark_number', { /*...*/ });
    
    // Actualiza estado local inmediatamente sin esperar confirmación ❌
    setMyCards(prevCards => /*...*/);
  }
};
```

### SOLUCIÓN:
```javascript
const handleMarkNumber = (cardId, position) => {
  if (socket) {
    socket.emit('bingo:mark_number', {
      roomCode: code,
      userId: user.id,
      cardId,
      position
    }, (response) => { // ← Agregar callback
      if (response.success) {
        // Solo actualizar estado local si backend confirma
        setMyCards(prevCards => /*...*/);
      } else {
        console.error('Error marcando número:', response.error);
      }
    });
  }
};
```

## 5. ⚠️ FALTA LISTENER PARA bingo:number_marked

### PROBLEMA:
El backend emite `socket.emit('bingo:number_marked', result)` pero el frontend no tiene listener para este evento.

### BACKEND (bingoV2.js línea 320):
```javascript
socket.emit('bingo:number_marked', result);
```

### FRONTEND:
❌ No hay listener para este evento

### SOLUCIÓN:
Agregar listener en BingoV2GameRoom:
```javascript
socket.on('bingo:number_marked', (data) => {
  console.log('Número marcado confirmado:', data);
  // Actualizar estado si es necesario
});
```

## RESUMEN DE FIXES NECESARIOS

### 🔴 PRIORIDAD ALTA:
1. ✅ Cargar marked_positions inicial desde card props
2. ✅ Agregar callback a socket.emit('bingo:mark_number')
3. ✅ Sincronizar estado solo después de confirmación del backend
4. ✅ Agregar listener para 'bingo:number_marked'

### 🟡 PRIORIDAD MEDIA:
5. Agregar reconexión: recargar marked_positions al reconectar socket
6. Implementar cola de marcado para manejar clics rápidos
7. Agregar indicador visual de "guardando..." mientras espera confirmación

### 🟢 MEJORAS FUTURAS:
8. Modal de victoria con opciones: salir o jugar otra ronda
9. Cambio aleatorio de host para la siguiente ronda
10. Sistema de rematch completo

## TESTING REALIZADO

✅ Crear sala - FUNCIONA
✅ Comprar cartones - FUNCIONA  
✅ Iniciar partida - FUNCIONA
✅ Cantar números - FUNCIONA
✅ Resaltado de números - FUNCIONA
✅ Marcado manual de números - FUNCIONA (visualmente)
⚠️ Sincronización con backend - FALLA
❌ Validación de BINGO - FALLA (por desincronización)
❌ Modal de victoria - NO PROBADO (no se llega)
❌ Nueva ronda - NO PROBADO

## LOGS DE CONSOLA

- Socket conecta y desconecta correctamente
- No hay errores JavaScript en consola
- Alert aparece: "El patrón aún no está completo"
- Backend logs: "Bingo invalid in room 955284"
