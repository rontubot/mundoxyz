-- Raffles tables only (Bingo tables are handled by 004_cleanup_and_recreate_bingo.sql)

-- Raffles table
CREATE TABLE IF NOT EXISTS raffles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('free', 'fires', 'coins')),
  entry_price_fire DECIMAL(18,2) DEFAULT 0 CHECK (entry_price_fire >= 0),
  entry_price_coin DECIMAL(18,2) DEFAULT 0 CHECK (entry_price_coin >= 0),
  entry_price_fiat DECIMAL(18,2) DEFAULT 0 CHECK (entry_price_fiat >= 0),
  numbers_range INTEGER NOT NULL DEFAULT 100,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'friends')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'drawing', 'finished', 'cancelled')),
  pot_fires DECIMAL(18,2) DEFAULT 0,
  pot_coins DECIMAL(18,2) DEFAULT 0,
  max_participants INTEGER,
  winner_id UUID REFERENCES users(id),
  winning_number INTEGER,
  host_meta JSONB DEFAULT '{}',
  prize_meta JSONB DEFAULT '{}',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  drawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffles_code ON raffles(code);
CREATE INDEX IF NOT EXISTS idx_raffles_host ON raffles(host_id);
CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status);
CREATE INDEX IF NOT EXISTS idx_raffles_visibility ON raffles(visibility);
CREATE INDEX IF NOT EXISTS idx_raffles_created ON raffles(created_at);

-- Raffle numbers table
CREATE TABLE IF NOT EXISTS raffle_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL CHECK (number_idx >= 0),
  state VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (state IN ('available', 'reserved', 'sold')),
  owner_id UUID REFERENCES users(id),
  owner_ext VARCHAR(128),
  reserved_by_ext VARCHAR(128),
  reserved_until TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  reference VARCHAR(255),
  transaction_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raffle_id, number_idx)
);

CREATE INDEX IF NOT EXISTS idx_raffle_numbers_raffle ON raffle_numbers(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_state ON raffle_numbers(state);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_owner ON raffle_numbers(owner_id) WHERE owner_id IS NOT NULL;

-- Raffle participants table
CREATE TABLE IF NOT EXISTS raffle_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_ext VARCHAR(128) NOT NULL,
  numbers INTEGER[] NOT NULL DEFAULT '{}',
  fires_spent DECIMAL(18,2) DEFAULT 0,
  coins_spent DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'winner', 'loser')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raffle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_raffle_participants_raffle ON raffle_participants(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_participants_user ON raffle_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_participants_status ON raffle_participants(status);

-- Raffle pending requests
CREATE TABLE IF NOT EXISTS raffle_pending_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL,
  user_id UUID REFERENCES users(id),
  user_ext VARCHAR(128) NOT NULL,
  reference VARCHAR(255),
  proof_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_requests_raffle ON raffle_pending_requests(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_status ON raffle_pending_requests(status);

-- Game history/stats table
CREATE TABLE IF NOT EXISTS game_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(32) NOT NULL, -- 'bingo', 'raffle', 'tictactoe'
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  fires_won DECIMAL(18,2) DEFAULT 0,
  coins_won DECIMAL(18,2) DEFAULT 0,
  fires_spent DECIMAL(18,2) DEFAULT 0,
  coins_spent DECIMAL(18,2) DEFAULT 0,
  highest_win_fires DECIMAL(18,2) DEFAULT 0,
  highest_win_coins DECIMAL(18,2) DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_type)
);

CREATE INDEX IF NOT EXISTS idx_game_stats_user ON game_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_type ON game_stats(game_type);

-- Triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_raffles_updated_at') THEN
    CREATE TRIGGER update_raffles_updated_at BEFORE UPDATE ON raffles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_game_stats_updated_at') THEN
    CREATE TRIGGER update_game_stats_updated_at BEFORE UPDATE ON game_stats
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;
