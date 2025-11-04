# Pruebas

## Unidades
- Repos `walletRepo`, `supplyRepo`, `welcomeRepo`: casos de crédito/débito, límites de supply, claims, export CSV.

## Integración
- Endpoints:
  - Auth TG (válido, hash inválido, replay).
  - Profile (sincronía con DB cuando aplica).
  - Economy supply (SSE, listados, export).
  - Fire requests (crear, pending, accept/reject).
  - Welcome admin (CRUD, activar/desactivar, accept).

## E2E (TestSprite)
- Genera plan y casos basado en rutas reales.
- Flujos: login TG → abrir `/games` → `/profile` → aceptar welcome → crear fire-request → aprobar como tote.

## Chrome DevTools
- Checklist en `testing/devtools-checklist.md`.
- Verifica consola (Sentry loaded), red (SSE), timings y errores CORS/CSP.

## Datos de prueba
- Usuario TG de QA (configurable por env) y seed opcional de saldos dev (`ECONOMY_DEV_*`).
