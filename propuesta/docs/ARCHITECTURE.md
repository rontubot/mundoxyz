# Arquitectura (MUNDOXYZ)

## Visión general
- Backend `Node.js/Express` con Sentry, Helmet, CORS, rate-limit y trust proxy.
- Frontend estático servido desde `public/` con scripts vanilla y soporte Telegram WebApp.
- Persistencia principal en Postgres (wallets, supply, eventos, juegos).
- Memoria de aplicación en `memoryStore` para sesiones, txs y estados transitorios.
- Redis planificado para sesiones/caché (plantilla incluida).
- SSE para “Supply dashboard”.

## Componentes backend
- `backend/server.js`: servidor Express, Sentry, Helmet (CSP), trust proxy, estáticos, rate-limit y rutas.
- `backend/config/config.js`: carga `.env(.local)`, `PORT`, `security.rateLimit` (RL_WINDOW_MS, RL_MAX_REQ).
- `backend/db/index.js`: Pool pg (DATABASE_URL o PGHOST/PGPORT/etc).
- `backend/routes/*`: módulos HTTP (auth, economy, welcome, roles, raffles, bingo, profile, etc.).
- `backend/repos/*`: acceso Postgres (walletRepo, supplyRepo, welcomeRepo, fireRequestsRepo, marketRepo, userRepo).
- `backend/services/*`: lógica en memoria (memoryStore) y stores específicos por juego.

## Flujo de identidad y sesión
- Cookies `uid` y `uidp`, y lectura opcional de `x-session-id` para entornos con cookies bloqueadas.
- `authStore` gestiona sesiones en memoria y fusiona cuentas `tg:`/`em:`.
- Logs de conexión a Postgres (`connection_logs`) y actualización de `users.last_seen_at`.

## Economía
- Moneda dual: `Coins` (suaves) y `Fires` (duros con supply).
- `wallets` + `wallet_transactions` (DB) y auditoría de emisión/quema en `supply_txs` + `fire_supply`.
- Eventos de bienvenida (`welcome_events`) con claims por usuario (`welcome_event_claims`).

## Rutas clave
- Autenticación: `/api/auth/login-telegram`, `/api/auth/login-telegram-widget`, `/api/auth/login-email`.
- Perfil: `/api/profile/:userId` (sincroniza/superpone saldos desde DB cuando aplica).
- Economy: `/api/economy/supply`, `/api/economy/supply/txs-db`, `/api/economy/supply/stream` (SSE), backfill welcome.
- Fuegos pedidos: `/api/economy/fire-requests/*` (crear, listar, aprobar/rechazar).
- Welcome admin: `/api/admin/welcome/*` (CRUD + activar/desactivar).
- Roles: `/api/roles/*` (me, grant, revoke, all).
- Salud: `/health`, `/api/db/health`.

## Juegos
- TicTacToe: `services/tictactoeStore.js` y `routes/tictactoe.js` (tick loop configurable `TTT_TICK_INTERVAL_MS`, opción `TTT_V2`, `TTT_DB_WALLET`).
- Bingo y Raffles cuentan con stores SQL y rutas dedicadas; persistencia en tablas `bingo_*`/`raffles*`.

## Estáticos y CSP
- `helmet` con CSP permisivo para Telegram y Sentry; `X-Frame-Options` eliminado para WebApp.
- Footer persistente, flecha de regreso y overlay con dos controles en pantallas secundarias.

## SSE
- `/api/economy/supply/stream`: heartbeat cada 15s y snapshot cada 5s desde `supplyRepo.getDashboardSnapshot()`.
