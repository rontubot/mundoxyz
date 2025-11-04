# Login de Telegram

## WebApp (initData)
- Endpoint: `POST /api/auth/login-telegram`.
- Verificación: `verifyTelegramInitData` firma `data_check_string` con HMAC-SHA256 usando `secretKey = HMAC_SHA256("WebAppData", bot_token)`.
- Anti-replay: `auth.checkAndStoreTelegramReplay({ hash, ttlSec })` + `TELEGRAM_REPLAY_TTL_SEC`.
- Frescura: `TELEGRAM_AUTH_MAX_SKEW_SEC` (por defecto 86400s).
- Sesión: set-cookie `sid` (`SameSite=None; Secure;` + cookie particionada `uidp`).
- Fusión de cuentas: si existe sesión previa no `tg:` se intenta `mergeUsers(primary=tg:, secondary=prev) `.

## Widget (Login Widget)
- Endpoint: `POST /api/auth/login-telegram-widget`.
- Verificación: ordenar pares (sin `hash`) y HMAC-SHA256 con `sha256(bot_token)`.

## Email/Password (opcional)
- `POST /api/auth/login-email`, `POST /api/auth/link-telegram`.
- Códigos de email emitidos por `issueEmailCode` (simulado por consola en dev).

## Cabeceras y cookies
- Soporte para `x-session-id` si el WebView bloquea cookies.
- Identidad anónima persistente `uid`/`uidp` con particionado.

## Variables
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`.
- `ALLOW_UNVERIFIED_TG_INIT` (solo QA), `TELEGRAM_AUTH_MAX_SKEW_SEC`, `TELEGRAM_REPLAY_TTL_SEC`.
