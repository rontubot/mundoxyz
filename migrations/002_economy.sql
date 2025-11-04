-- Economy tables: fire_supply, supply_txs, welcome_events, fire_requests, market_redeems

-- Fire supply control table (singleton)
CREATE TABLE IF NOT EXISTS fire_supply (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_max DECIMAL(24,2) NOT NULL DEFAULT 1000000,
  total_emitted DECIMAL(24,2) NOT NULL DEFAULT 0 CHECK (total_emitted >= 0),
  total_burned DECIMAL(24,2) NOT NULL DEFAULT 0 CHECK (total_burned >= 0),
  total_circulating DECIMAL(24,2) GENERATED ALWAYS AS (total_emitted - total_burned) STORED,
  total_reserved DECIMAL(24,2) NOT NULL DEFAULT 0 CHECK (total_reserved >= 0),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_supply CHECK (total_emitted <= total_max)
);

-- Insert singleton row
INSERT INTO fire_supply (id, total_max, total_emitted, total_burned, total_reserved)
VALUES (1, 1000000, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Supply transactions audit log
CREATE TABLE IF NOT EXISTS supply_txs (
  id BIGSERIAL PRIMARY KEY,
  transaction_hash UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  type VARCHAR(32) NOT NULL, -- 'emission', 'burn', 'welcome_bonus', 'game_reward', 'market_redeem', 'admin_grant'
  currency VARCHAR(10) NOT NULL CHECK (currency IN ('fires', 'coins')),
  amount DECIMAL(18,2) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_ext VARCHAR(128), -- External user identifier (tg:123, em:email, etc.)
  event_id INTEGER,
  reference VARCHAR(255),
  description TEXT,
  meta JSONB DEFAULT '{}',
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(128),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_txs_type ON supply_txs(type);
CREATE INDEX IF NOT EXISTS idx_supply_txs_user_id ON supply_txs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supply_txs_created_at ON supply_txs(created_at);
CREATE INDEX IF NOT EXISTS idx_supply_txs_hash ON supply_txs(transaction_hash);

-- Welcome events table
CREATE TABLE IF NOT EXISTS welcome_events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  message TEXT,
  coins_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (coins_amount >= 0),
  fires_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (fires_amount >= 0),
  duration_hours INTEGER NOT NULL DEFAULT 72,
  max_claims INTEGER,
  is_active BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_events_active ON welcome_events(is_active);
CREATE INDEX IF NOT EXISTS idx_welcome_events_dates ON welcome_events(starts_at, ends_at);

-- Welcome event claims tracking
CREATE TABLE IF NOT EXISTS welcome_event_claims (
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_ext VARCHAR(128) NOT NULL,
  coins_claimed DECIMAL(18,2) NOT NULL DEFAULT 0,
  fires_claimed DECIMAL(18,2) NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  PRIMARY KEY(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_welcome_claims_user ON welcome_event_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_welcome_claims_claimed_at ON welcome_event_claims(claimed_at);

-- Welcome event history/audit
CREATE TABLE IF NOT EXISTS welcome_event_history (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL, -- 'created', 'updated', 'activated', 'deactivated', 'claimed'
  actor_id UUID REFERENCES users(id),
  actor_name VARCHAR(128),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_history_event ON welcome_event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_welcome_history_action ON welcome_event_history(action);

-- Fire requests table (users request fires from tote)
CREATE TABLE IF NOT EXISTS fire_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reference VARCHAR(255),
  proof_url TEXT,
  notes TEXT,
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fire_requests_user ON fire_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_fire_requests_status ON fire_requests(status);
CREATE INDEX IF NOT EXISTS idx_fire_requests_created ON fire_requests(created_at);

-- Market redeems table (users redeem fires for real money)
CREATE TABLE IF NOT EXISTS market_redeems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fires_amount DECIMAL(18,2) NOT NULL DEFAULT 100 CHECK (fires_amount > 0),
  fiat_amount DECIMAL(18,2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  cedula VARCHAR(20),
  phone VARCHAR(32),
  bank_code VARCHAR(10),
  bank_name VARCHAR(128),
  bank_account VARCHAR(64),
  payment_method VARCHAR(32), -- 'bank_transfer', 'mobile_payment', etc.
  transaction_id VARCHAR(128),
  proof_url TEXT,
  notes TEXT,
  processor_id UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  processor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_redeems_user ON market_redeems(user_id);
CREATE INDEX IF NOT EXISTS idx_market_redeems_status ON market_redeems(status);
CREATE INDEX IF NOT EXISTS idx_market_redeems_created ON market_redeems(created_at);

-- Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_welcome_events_updated_at') THEN
    CREATE TRIGGER update_welcome_events_updated_at BEFORE UPDATE ON welcome_events
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fire_requests_updated_at') THEN
    CREATE TRIGGER update_fire_requests_updated_at BEFORE UPDATE ON fire_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_market_redeems_updated_at') THEN
    CREATE TRIGGER update_market_redeems_updated_at BEFORE UPDATE ON market_redeems
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;
