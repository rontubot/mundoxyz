# MUNDOXYZ

Base de documentación y plantillas para construir una MiniApp de Telegram con juegos, economía dual (Coins/Fires), Postgres y Redis.

## Alcance
- Backend Node/Express con Sentry, Helmet, rate-limit y trust proxy.
- Autenticación Telegram (WebApp y Widget) con verificación HMAC, anti-replay y sesiones seguras.
- Modelo económico: Coins (soft) y Fires (duros) con supply auditable en DB.
- Persistencia en Postgres (wallets, transacciones, eventos de bienvenida, supply_txs, juegos Bingo/Raffles).
- Redis para caché/sesiones y escalabilidad futura.
- SSE y flujos en tiempo real.
- Plantillas de configuración (.env), Docker Compose (Postgres + Redis + Adminer), SQL de migraciones.
- Plan de pruebas (TestSprite + Chrome DevTools) y monitoreo (Sentry + logs).

## Estructura
```
MUNDOXYZ/
├─ README.md
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ DATA_MODEL.md
│  ├─ ECONOMY.md
│  ├─ TELEGRAM_LOGIN.md
│  ├─ API.md
│  ├─ CONFIG.md
│  ├─ DEPLOYMENT.md
│  ├─ SECURITY.md
│  ├─ TESTING.md
│  ├─ MONITORING.md
│  ├─ UI_GUIDE.md
│  └─ MIGRATIONS.md
├─ env/
│  └─ .env.example
├─ infra/
│  └─ docker-compose.yml
├─ db/
│  └─ migrations/
│     ├─ 0001_core.sql
│     ├─ 0002_raffles.sql
│     ├─ 0003_bingo.sql
│     ├─ 0004_fire_and_market.sql
│     ├─ 0005_welcome_events.sql
│     └─ 0006_supply_txs.sql
├─ diagrams/
│  ├─ ERD.mmd
│  └─ telegram-auth-flow.mmd
├─ testing/
│  ├─ testsprite-plan.md
│  └─ devtools-checklist.md
├─ playbooks/
│  ├─ runbooks.md
│  └─ seed-and-backfill.md
└─ examples/
   └─ http-requests.http
```

## Uso
- Lee `docs/CONFIG.md` y copia `env/.env.example` como base para tu entorno.
- Arranca Postgres/Redis con `infra/docker-compose.yml`.
- Aplica SQL de `db/migrations/` en orden.
- Implementa endpoints tomando como referencia `docs/API.md` y los modelos de `docs/DATA_MODEL.md`.
- Sigue `docs/TESTING.md` (TestSprite + Chrome DevTools) y `docs/MONITORING.md`.

## Notas
- Los esquemas y flujos están derivados del proyecto actual (`backend/routes/*`, `backend/repos/*`, `backend/services/*`).
- Ajusta valores como límites, CSP y rate-limits según tu despliegue.
