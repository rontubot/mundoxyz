# Migraciones SQL

## Orden recomendado
1. 0001_core.sql (usuarios, roles, wallets, sesiones, logs)
2. 0002_raffles.sql
3. 0003_bingo.sql
4. 0004_fire_and_market.sql (fire_requests, market_redeems)
5. 0005_welcome_events.sql
6. 0006_supply_txs.sql (incluye fire_supply)

## Aplicación
- Con `psql`:
```bash
psql "$DATABASE_URL" -f db/migrations/0001_core.sql
psql "$DATABASE_URL" -f db/migrations/0002_raffles.sql
psql "$DATABASE_URL" -f db/migrations/0003_bingo.sql
psql "$DATABASE_URL" -f db/migrations/0004_fire_and_market.sql
psql "$DATABASE_URL" -f db/migrations/0005_welcome_events.sql
psql "$DATABASE_URL" -f db/migrations/0006_supply_txs.sql
```

- O usando herramientas de migración (Knex/Prisma) adaptando a estos esquemas.
