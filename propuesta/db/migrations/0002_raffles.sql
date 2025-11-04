-- Raffles
CREATE TABLE IF NOT EXISTS raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  mode VARCHAR(16) NOT NULL,
  entry_price_fire NUMERIC(18,2) DEFAULT 0,
  entry_price_fiat NUMERIC(18,2) DEFAULT 0,
  range VARCHAR(16) DEFAULT '00-99',
  visibility VARCHAR(16) DEFAULT 'public',
  status VARCHAR(16) DEFAULT 'open',
  pot_fires NUMERIC(18,2) DEFAULT 0,
  host_meta JSONB,
  prize_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS raffles_host_idx ON raffles(host_id);

CREATE TABLE IF NOT EXISTS raffle_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'available',
  reserved_by_ext TEXT,
  reserved_until TIMESTAMPTZ,
  sold_to_ext TEXT,
  reference TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raffle_id, number_idx)
);
CREATE INDEX IF NOT EXISTS raffle_numbers_state_idx ON raffle_numbers(raffle_id, state);

CREATE TABLE IF NOT EXISTS raffle_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_ext TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  numbers INTEGER[] NOT NULL DEFAULT '{}',
  fires_spent NUMERIC(18,2) DEFAULT 0,
  status VARCHAR(16) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS raffle_participants_user_idx ON raffle_participants(raffle_id, user_ext);

CREATE TABLE IF NOT EXISTS raffle_pending_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL,
  user_ext TEXT NOT NULL,
  reference TEXT,
  proof_url TEXT,
  status VARCHAR(16) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS raffle_pending_status_idx ON raffle_pending_requests(raffle_id, status);
