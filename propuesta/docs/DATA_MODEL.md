# Modelo de Datos (Postgres)

## Núcleo
- roles(id PK, name UNIQUE)
- users(id UUID PK, xyz_id UNIQUE, tg_id UNIQUE, username, display_name, email UNIQUE, phone, avatar_url, created_at, updated_at, first_seen_at, last_seen_at)
- auth_identities(id UUID PK, user_id FK users.id, provider, provider_uid, password_hash, meta, created_at, UNIQUE(provider,provider_uid))
- user_roles(user_id FK users.id, role_id FK roles.id, PK compuesta)
- wallets(id UUID PK, user_id UNIQUE FK users.id, fires_balance NUMERIC, coins_balance NUMERIC, updated_at)
- wallet_transactions(id UUID PK, wallet_id FK wallets.id, type, amount_fire NUMERIC, amount_coin NUMERIC, reference, meta JSONB, created_at)
- user_sessions(id UUID PK, user_id FK users.id, created_at, expires_at, ip, ua, data JSONB)
- connection_logs(id UUID PK, user_id FK users.id NULL, ts, ua, platform, ip, meta JSONB)

## Juegos
- raffles(id UUID PK, code UNIQUE, host_id FK users.id, name, mode, entry_price_fire, entry_price_fiat, range, visibility, status, pot_fires, host_meta JSONB, prize_meta JSONB, created_at, ends_at)
- raffle_numbers(id UUID PK, raffle_id FK raffles.id, number_idx, state, reserved_by_ext, reserved_until, sold_to_ext, reference, updated_at, UNIQUE(raffle_id, number_idx))
- raffle_participants(id UUID PK, raffle_id FK raffles.id, user_ext, user_id FK users.id, numbers int[], fires_spent, status, created_at)
- raffle_pending_requests(id UUID PK, raffle_id FK raffles.id, number_idx, user_ext, reference, proof_url, status, created_at)

- bingo_rooms(id UUID PK, code UNIQUE, host_id FK users.id, name, mode, entry_price_fire, pot_fires, status, numbers_drawn int[], rules_meta JSONB, created_at, starts_at, ends_at)
- bingo_players(id UUID PK, room_id FK bingo_rooms.id, user_ext, user_id FK users.id, fires_spent, cards_count, status, created_at, UNIQUE(room_id,user_ext))
- bingo_cards(id UUID PK, room_id FK bingo_rooms.id, player_id FK bingo_players.id, card JSONB, is_winner, claimed_at, claim_ref)
- bingo_draws(id UUID PK, room_id FK bingo_rooms.id, number, drawn_at)
- bingo_claims(id UUID PK, room_id FK bingo_rooms.id, card_id FK bingo_cards.id, user_ext, player_id FK bingo_players.id, status, review_notes, created_at)

## Bienvenida y Supply
- welcome_events(id SERIAL PK, name, message, coins, fires, duration_hours, starts_at, ends_at, active, created_by, created_at, updated_at)
- welcome_event_history(id SERIAL PK, event_id FK, action, actor, payload JSONB, created_at)
- welcome_event_claims(PK compuesta: event_id FK, user_ext, claimed_at)
- fire_supply(id SMALLINT PK=1, total_max NUMERIC, emitted NUMERIC, updated_at)
- supply_txs(id BIGSERIAL PK, ts, type, amount NUMERIC, user_ext, user_id UUID, event_id FK welcome_events.id, reference, meta JSONB, actor)

## Relaciones clave
- 1:N users→wallets (1:1), users→wallet_transactions (indirecto), users→user_roles, users→connection_logs.
- raffles y bingo referencian `users` y usan `user_ext` para IDs externos `tg:/db:/em:`.
- supply audita eventos de emisión/quema y sus referencias.

## Convenciones
- `user_ext`: identificador externo (`tg:123`, `db:UUID`, `em:email`).
- `amount_*` NUMERIC(18,2) para valores monetarios; `supply` NUMERIC(24,2).
- Fechas `TIMESTAMPTZ`.
