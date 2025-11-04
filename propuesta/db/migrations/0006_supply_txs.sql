--- Fire supply (global)
CREATE TABLE IF NOT EXISTS fire_supply (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  total_max NUMERIC(24,2) NOT NULL DEFAULT 1000000000,
  emitted NUMERIC(24,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO fire_supply(id, total_max, emitted, updated_at)
  VALUES (1, 1000000000, 0, NOW())
  ON CONFLICT (id) DO NOTHING;

-- Supply transactions
CREATE TABLE IF NOT EXISTS supply_txs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  amount NUMERIC(24,2) NOT NULL DEFAULT 0,
  user_ext TEXT,
  user_id UUID,
  event_id INTEGER REFERENCES welcome_events(id) ON DELETE SET NULL,
  reference TEXT,
  meta JSONB,
  actor TEXT
);
CREATE INDEX IF NOT EXISTS supply_txs_ts_idx ON supply_txs(ts);
CREATE INDEX IF NOT EXISTS supply_txs_type_idx ON supply_txs(type);
CREATE INDEX IF NOT EXISTS supply_txs_event_idx ON supply_txs(event_id);
CREATE INDEX IF NOT EXISTS supply_txs_userext_idx ON supply_txs(user_ext);
