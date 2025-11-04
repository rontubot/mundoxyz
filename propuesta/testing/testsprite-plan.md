# Plan de pruebas con TestSprite (MUNDOXYZ)

## Contexto
- Backend Express en `PORT=3000`.
- Rutas clave: auth (Telegram), profile, economy (supply, SSE), fire-requests, market, admin-welcome, roles.

## Bootstrapping
- localPort: 3000
- type: backend
- scope: codebase (inicial)
- Precondiciones: `.env` válido + DB con migraciones aplicadas.

## Plan (IDs sugeridos)
- TS-001 Login Telegram (válido): `POST /api/auth/login-telegram` → 200 y set-cookie `sid`.
- TS-002 Login Telegram (hash inválido): 400 `invalid_hash`.
- TS-003 Anti-replay: repetir initData → 400 `replay_detected`.
- TS-010 Roles/me autenticado: `GET /api/roles/me` → roles no vacíos.
- TS-020 Profile: `GET /api/profile/:userId` → agrega inbox y saldos.
- TS-030 Supply snapshot: `GET /api/economy/supply` → { total, circulating, burned, reserve }.
- TS-031 Supply SSE: `GET /api/economy/supply/stream` → eventos recibidos.
- TS-040 FireRequests create: `POST /api/economy/fire-requests/create` → 200, notificación admin (si `TELEGRAM_BOT_TOKEN`).
- TS-041 FireRequests pending (tote/admin): lista con items ≥ 0.
- TS-042 FireRequests accept (tote/admin): saldo de wallet +, supply emitted +.
- TS-050 Market redeem create: `POST /api/market/redeem-100-fire` → 200.
- TS-051 Market pending (tote/admin): lista con items ≥ 0.
- TS-052 Market accept: wallet −100🔥 y supply_txs con `burn_market_redeem`.
- TS-060 Welcome admin CRUD: create/update/activate/deactivate → 200 y estado consistente.
- TS-061 Welcome accept: `POST /api/welcome/accept` → wallet +, supply_txs `welcome_bonus`.

## Datos
- Semilla roles por env: `ROLE_TOTE_USER_IDS`, `ROLE_ADMIN_USER_IDS`.
- QA user dev: `pruebatote@example.com / pruebatote` (si seed activo).

## Validaciones adicionales
- Rate limit bypass: UA Telegram y `x-test-runner: testsprite` con `ALLOW_TEST_RUNNER=true`.
- CSP/Headers: sin `X-Frame-Options` y `Content-Security-Policy` compatible.
