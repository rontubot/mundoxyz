# 🔥 CÓMO DAR FIRES A USUARIOS PARA PRUEBAS

## Opción 1: Panel Admin (Recomendado)

1. Ir a: https://confident-bravery-production-ce7b.up.railway.app/admin
2. Login con cuenta admin
3. Ir a "Economy" → "Grant Balance"
4. Buscar usuario por username o ID
5. Seleccionar "fires" 
6. Ingresar cantidad (ej: 10)
7. Click "Grant"

## Opción 2: SQL Directo en Railway

```sql
-- Ver balance actual del usuario
SELECT u.username, w.fires_balance, w.coins_balance 
FROM users u 
JOIN wallets w ON w.user_id = u.id 
WHERE u.username = 'NOMBRE_USUARIO';

-- Dar 10 fires a un usuario específico
UPDATE wallets 
SET fires_balance = fires_balance + 10,
    total_fires_earned = total_fires_earned + 10
WHERE user_id = (SELECT id FROM users WHERE username = 'NOMBRE_USUARIO');

-- Verificar que se actualizó
SELECT u.username, w.fires_balance 
FROM users u 
JOIN wallets w ON w.user_id = u.id 
WHERE u.username = 'NOMBRE_USUARIO';
```

## Opción 3: API Endpoint (con token admin)

```bash
# Primero obtener token admin
curl -X POST https://confident-bravery-production-ce7b.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tu_password"}'

# Usar el token para dar fires
curl -X POST https://confident-bravery-production-ce7b.up.railway.app/api/economy/admin/grant \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_ID",
    "amount": 10,
    "currency": "fires",
    "description": "Test grant for TicTacToe"
  }'
```

## Para Pruebas de La Vieja

### Dar fires para crear salas:
```sql
-- Dar 5 fires a todos los usuarios para pruebas
UPDATE wallets 
SET fires_balance = fires_balance + 5,
    total_fires_earned = total_fires_earned + 5;
```

### Ver usuarios con fires:
```sql
SELECT u.username, u.id, w.fires_balance, w.coins_balance
FROM users u
JOIN wallets w ON w.user_id = u.id
WHERE w.fires_balance > 0
ORDER BY w.fires_balance DESC;
```

### Reset fires de un usuario:
```sql
UPDATE wallets 
SET fires_balance = 0
WHERE user_id = 'USER_ID';
```

## NOTAS IMPORTANTES

- Los fires son la moneda premium (más valiosa)
- En La Vieja, el modo Fires es fijo en 1 fire
- El modo Coins permite apuestas de 1-1000
- Sin comisión: 100% del pot al ganador
- En empate: 50% a cada jugador

## Balance Mínimo Recomendado para Pruebas

- **Fires**: 3-5 (para varias partidas)
- **Coins**: 100-500 (para diferentes apuestas)

---

**Recuerda:** El endpoint `/api/economy/balance` ya está funcionando y mostrará el balance actualizado en el frontend.
