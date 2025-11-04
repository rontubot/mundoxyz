# Seed y Backfill (MUNDOXYZ)

## Semillas
- **Roles**
  - Env: `ROLE_TOTE_USER_IDS` y `ROLE_ADMIN_USER_IDS` (IDs `tg:/db:/em:` separados por coma/espacio).
  - Efecto: `backend/server.js` otorga roles al iniciar.
- **Usuario QA**
  - Si el store de email está activo, se crea/valida `pruebatote@example.com / pruebatote`.
- **Welcome auto-start**
  - Env: `WELCOME_AUTOSTART=true` activa evento con 100 coins y 10 🔥 si no hay activo.

## Migraciones
- Aplica en orden `db/migrations/` (ver `docs/MIGRATIONS.md`).

## Backfill de Supply (welcome_bonus)
- Endpoint: `POST /api/economy/supply/backfill/welcome-bonus` (admin). Parámetros: `from`, `to`, `limit`, `dryRun`.
- Propósito: Insertar en `supply_txs` las transacciones de bienvenida que no estén auditadas.

## SQL útiles
```sql
-- Revisar supply
SELECT * FROM fire_supply;

-- Ajustar tope
UPDATE fire_supply SET total_max = 1000000 WHERE id=1;

-- Ver movimientos supply
SELECT * FROM supply_txs ORDER BY ts DESC LIMIT 50;

-- Revisar/crear wallet por usuario DB
INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) VALUES ('<uuid>',0,0,NOW()) ON CONFLICT (user_id) DO NOTHING;
SELECT * FROM wallets WHERE user_id = '<uuid>';
```
