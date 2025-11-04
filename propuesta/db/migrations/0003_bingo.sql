-- Bingo
CREATE TABLE IF NOT EXISTS bingo_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  mode VARCHAR(16) NOT NULL DEFAULT 'friendly',
  entry_price_fire NUMERIC(18,2) DEFAULT 0,
  pot_fires NUMERIC(18,2) DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  numbers_drawn INTEGER[] NOT NULL DEFAULT '{}',
  rules_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS bingo_rooms_host_idx ON bingo_rooms(host_id);

CREATE TABLE IF NOT EXISTS bingo_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
  user_ext TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  fires_spent NUMERIC(18,2) DEFAULT 0,
  cards_count INTEGER DEFAULT 0,
  status VARCHAR(16) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_ext)
);

CREATE TABLE IF NOT EXISTS bingo_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES bingo_players(id) ON DELETE SET NULL,
  card JSONB NOT NULL,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  claim_ref TEXT
);
CREATE INDEX IF NOT EXISTS bingo_cards_room_player_idx ON bingo_cards(room_id, player_id);

CREATE TABLE IF NOT EXISTS bingo_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  drawn_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bingo_draws_room_number_idx ON bingo_draws(room_id, number);

CREATE TABLE IF NOT EXISTS bingo_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
  card_id UUID REFERENCES bingo_cards(id) ON DELETE SET NULL,
  user_ext TEXT NOT NULL,
  player_id UUID REFERENCES bingo_players(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bingo_claims_room_status_idx ON bingo_claims(room_id, status);
