# Runbooks de Operación (MUNDOXYZ)

## Inicio rápido
- **[Config]** Copia `env/.env.example` → `.env` y define `DATABASE_URL`, `SENTRY_DSN`, `TELEGRAM_*`, `ADMIN_USERNAME/ADMIN_CODE`.
- **[Infra]** `docker compose -f infra/docker-compose.yml up -d` (Postgres/Redis/Adminer).
- **[Migraciones]** Aplica `db/migrations/*` en orden (ver `docs/MIGRATIONS.md`).
- **[Servidor]** Inicia el backend (según tu implementación). Verifica `/health` y `/api/db/health`.

## Incidentes comunes
- **[Rate-limit detrás de proxy]**
  - Síntoma: 429 inesperados o validación de `express-rate-limit`.
  - Acción: Asegura `TRUST_PROXY_HOPS` y que el proxy reenvía `X-Forwarded-For`.
- **[CSP / X-Frame-Options]**
  - Síntoma: WebApp embebida bloqueada.
  - Acción: Confirma que el backend elimina `X-Frame-Options` y CSP permite Telegram y Sentry.
- **[Conexión DB]**
  - Síntoma: `/api/db/health` falla.
  - Acción: Revisa `DATABASE_URL`, SSL, y reachability. Usa Adminer `http://localhost:8080`.

## Operaciones
- **[Aprobar Fuegos Pedidos]**
  - Requisito: Rol `tote`/`admin` (o headers adminAuth).
  - Endpoint: `POST /api/economy/fire-requests/:id/accept`.
  - Efecto: Acredita wallet (fires +), incrementa `fire_supply.emitted`, agrega `wallet_transactions`.
- **[Rechazar Fuegos Pedidos]**
  - Endpoint: `POST /api/economy/fire-requests/:id/reject`.
- **[Aceptar Canje de Mercado]**
  - Endpoint: `POST /api/market/redeems/:id/accept`.
  - Efecto: Debita 100 🔥, registra `wallet_transactions` y `supply_txs (burn_market_redeem)`.
- **[Welcome Events]**
  - Crear: `POST /api/admin/welcome/events`.
  - Activar: `POST /api/admin/welcome/events/:id/activate`.
  - Desactivar: `POST /api/admin/welcome/events/:id/deactivate`.
- **[Cambiar tope de supply]**
  - Ejecuta SQL: `UPDATE fire_supply SET total_max = ... WHERE id=1;`.

## Monitoreo
- **[Sentry]** Backend/Frontend con DSN. Verifica eventos con `Sentry.captureMessage('QA ping')` en cliente.
- **[Logs de conexión]** Revisa tabla `connection_logs` y `users.last_seen_at`.

## Seguridad
- **[adminAuth]** Headers `x-admin-username` + `x-admin-code`. Bypass QA: `ALLOW_TEST_RUNNER=true` + `x-test-runner: testsprite`.
- **[Roles]** Asigna `ROLE_TOTE_USER_IDS` y `ROLE_ADMIN_USER_IDS` para semillas.
