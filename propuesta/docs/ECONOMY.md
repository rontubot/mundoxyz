# Economía (Coins/Fires)

- Coins: puntos suaves (no afectan supply); premios y UI.
- Fires: moneda dura con supply auditable en DB.

## Supply
- `fire_supply(id=1, total_max, emitted)` controla emisión global.
- Dashboard: `getDashboardSnapshot()` = { total, circulating, burned, reserve }.

## Auditoría
- `supply_txs`: ts, type, amount, user_ext, user_id, event_id, reference, meta, actor.
- Export: `/api/economy/supply/txs-db/export.csv`.

## Wallet
- `wallets` (fires_balance, coins_balance) y `wallet_transactions` (abonos/cargos con tipo y referencia).
- Débitos usan `FOR UPDATE` y no permiten saldo negativo.

## Bienvenida (opt-in)
- `welcome_events` (coins/fires, duración) + `welcome_event_claims` (claim por usuario).
- `POST /api/welcome/accept` acredita wallet + supply.

## Fuegos pedidos
- `create → accept/reject` (admin/tote). `accept` acredita a wallet y ajusta supply.

## Invariantes
- `emitted <= total_max`.
- Un solo claim por (evento, usuario).
