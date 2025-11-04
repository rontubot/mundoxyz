# Despliegue

## Local
1. Copia `env/.env.example` → `.env` y ajusta variables.
2. `docker compose -f infra/docker-compose.yml up -d` (Postgres, Redis, Adminer).
3. Aplica SQL de `db/migrations` en orden.
4. Ejecuta el backend con tus scripts (e.g., `npm start`).

## Railway (recomendado)
- Configura variables: `DATABASE_URL`, `SENTRY_DSN`, `TELEGRAM_*`, `RL_*`, `TRUST_PROXY_HOPS`.
- Habilita trust proxy (ya en código) y ajusta RL según tráfico.
- Verifica `/health` y `/api/db/health` post-deploy.

## Notas operativas
- Detrás de proxy, `express-rate-limit` requiere `app.set('trust proxy', N)`.
- SSE: mantén timeouts superiores a 30s (Railway funciona bien).
- CSP: ajusta orígenes si agregas CDNs.
