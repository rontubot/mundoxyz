# API (resumen)

## Auth
- POST `/api/auth/login-telegram` { initData }
- POST `/api/auth/login-telegram-widget` { data }
- POST `/api/auth/login-email` { email, password }
- POST `/api/auth/link-telegram` { email, telegramId }

## Profile
- GET `/api/profile/:userId`
- POST `/api/profile/update` { userId, displayName }

## Roles
- GET `/api/roles/me`
- POST `/api/roles/grant` { userId, role }
- POST `/api/roles/revoke` { userId, role }
- GET `/api/roles/all`

## Welcome
- GET `/api/welcome/status`
- GET `/api/welcome/current`
- POST `/api/welcome/accept` { userId?, eventId? }

## Welcome (admin)
- GET `/api/admin/welcome/events?includeInactive=`
- POST `/api/admin/welcome/events` { name, message, coins, fires, durationHours }
- PATCH `/api/admin/welcome/events/:id`
- POST `/api/admin/welcome/events/:id/activate` { startsAt? }
- POST `/api/admin/welcome/events/:id/deactivate`
- GET `/api/admin/welcome/status`
- POST `/api/admin/welcome/activate` { coins, fires, durationHours, startsAt?, message? }
- POST `/api/admin/welcome/disable`

## Economy
- GET `/api/economy/supply` → snapshot (DB)
- GET `/api/economy/supply/stream` (SSE)
- GET `/api/economy/supply/txs-db` (filtros: type, user_ext, event_id, from, to, limit, offset, order)
- GET `/api/economy/supply/txs-db/:id`
- GET `/api/economy/supply/txs-db/export.csv`
- POST `/api/economy/supply/burn` (admin)
- POST `/api/economy/supply/backfill/welcome-bonus` (admin)

## Fire Requests
- POST `/api/economy/fire-requests/create` { userId?, amount, reference }
- GET `/api/economy/fire-requests/my/:userId`
- GET `/api/economy/fire-requests/pending` (tote/admin)
- GET `/api/economy/fire-requests/list?status=` (tote/admin)
- POST `/api/economy/fire-requests/:id/accept` (tote/admin)
- POST `/api/economy/fire-requests/:id/reject` (tote/admin)

## Economy (extended: sponsors)
- GET `/api/economy/users?cursor=&limit=&search=`
- GET `/api/economy/history/:userId?limit=&offset=`
- GET `/api/economy/sponsors`
- POST `/api/economy/sponsors/add` (admin) { userId, key, description, initialAmount }
- POST `/api/economy/sponsors/remove` (admin) { userId }
- POST `/api/economy/sponsors/set-meta` (admin) { userId, description }
- POST `/api/economy/sponsors/set-key` (admin) { userId, key }
- POST `/api/economy/sponsors/remove-key` (admin) { userId }
- POST `/api/economy/transfer` { fromUserId, toUserId, amount, sponsorKey, reason }
- POST `/api/economy/grant-from-supply` (admin) { toUserId, amount, reason }

## Market
- POST `/api/market/redeem-100-fire` { userId?, cedula, telefono, bankCode, bankName }
- GET `/api/market/redeems/pending` (tote/admin)
- GET `/api/market/redeems/list?status=` (tote/admin)
- POST `/api/market/redeems/:id/accept` (tote/admin)
- POST `/api/market/redeems/:id/reject` (tote/admin)

## Otros
- GET `/health`
- GET `/api/db/health`
- GET `/config.js` → expone DSN y flags front

Notas: Juegos (`/api/games/*`, `/api/raffles`, `/api/games/bingo`) están disponibles; ver rutas específicas.
