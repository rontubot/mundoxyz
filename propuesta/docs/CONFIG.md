# Configuración (.env)

## Servidor
- NODE_ENV=development|production
- PORT=3000
- HOST=0.0.0.0
- FRONTEND_URL=http://localhost:3000

## Rate limit y proxy
- RL_WINDOW_MS=60000
- RL_MAX_REQ=120
- TRUST_PROXY_HOPS=1
- ALLOW_TEST_RUNNER=true|false (para bypass de QA con header `x-test-runner: testsprite`)

## Sentry
- SENTRY_DSN=(dsn)
- SENTRY_TRACES_RATE=0.2

## Base de datos (Postgres)
- DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
- PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (alternativa)
- PGPOOL_MAX=10
- PGPOOL_IDLE_MS=30000
- PGSSLMODE=require|disable

## Redis (opcional)
- REDIS_HOST=localhost
- REDIS_PORT=6379
- REDIS_PASSWORD=
- REDIS_DB=0

## Telegram
- TELEGRAM_BOT_TOKEN=
- TELEGRAM_BOT_USERNAME=
- FIRE_REQUEST_ADMIN_TG_ID=1417856820
- TELEGRAM_AUTH_MAX_SKEW_SEC=86400
- TELEGRAM_REPLAY_TTL_SEC=120
- ALLOW_UNVERIFIED_TG_INIT=false (solo QA)

## Features/Flags
- TTT_V2=true|false
- TTT_DB_WALLET=true|false
- WELCOME_AUTOSTART=true|false
- ECONOMY_DEV_AUTO_SEED=true|false
- ECONOMY_DEV_SEED_COINS=100
- ECONOMY_DEV_SEED_FIRES=0

## Roles (semilla)
- ROLE_TOTE_USER_IDS="tg:141...,em:user@example.com"
- ROLE_ADMIN_USER_IDS="tg:...,db:..."
- TOTE_ID=(fallback único)

## UI/WebApp
- PUBLIC_WEBAPP_URL=https://your-domain/portal.html

## Admin (header-based)
- ADMIN_USERNAME=Wilcnct
- ADMIN_CODE=658072974
