# Monitoreo

## Sentry
- Backend: DSN por `SENTRY_DSN`, tasas por `SENTRY_TRACES_RATE`.
- Frontend: `/config.js` expone `window.__SENTRY_DSN__`; carga condicional en cliente.

## Salud
- `/health`: disponibilidad app.
- `/api/db/health`: disponibilidad DB.

## Logs y métricas
- `connection_logs` en DB con UA, plataforma e IP.
- Métricas recomendadas: usuarios activos, supply snapshot, errores/min, latencia por ruta.
