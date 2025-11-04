# Seguridad

## Headers y CSP
- Helmet con CSP: scripts permitidos para Tailwind, Telegram SDK, jsDelivr y Sentry.
- Eliminación de `X-Frame-Options` para permitir WebApp embebida en Telegram.
- Cookies `uid/uidp` con `SameSite=None; Secure;` y particionadas (CHIPS).

## Rate limiting
- Configurable por env (`RL_WINDOW_MS`, `RL_MAX_REQ`).
- Exclusiones: webhooks de Telegram, UA de Telegram, rutas de login y runners de pruebas.

## Autorización y roles
- Roles en memoria (`services/roles`) + tabla `roles`/`user_roles` en DB.
- Endpoints admin/privados requieren `tote` o `admin` (o `adminAuth` por header/credencial de respaldo).

## Integridad económica
- Control de supply (`emitted <= total_max`).
- Transacciones con `SELECT ... FOR UPDATE` y verificación de saldos.
- Auditoría en `supply_txs` con export CSV.

## Anti-replay y frescura (Telegram)
- TTL y skew configurables. Hash timing-safe.

## Logging
- Sentry (backend y cliente) y `connection_logs` en DB.

## AdminAuth (cabeceras y bypass QA)
- Cabeceras esperadas:
  - `x-admin-username`: usuario admin normalizado (sin @, minúsculas).
  - `x-admin-code`: código secreto de admin.
- Variables:
  - `ADMIN_USERNAME`, `ADMIN_CODE` definen credenciales válidas.
  - `ALLOW_TEST_RUNNER=true` permite bypass de QA si el header `x-test-runner` contiene `testsprite`.
- Bypass QA seguro: requiere ambas condiciones (env + header). Asigna `req.admin.userName`.
