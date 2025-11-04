-- Fire Requests y Market Redeems

-- Solicitudes de fuegos
CREATE TABLE IF NOT EXISTS fire_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ext TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  meta JSONB
);
CREATE INDEX IF NOT EXISTS fire_requests_status_created_idx ON fire_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS fire_requests_user_idx ON fire_requests(user_ext);

-- Canjes de mercado (quemar)
CREATE TABLE IF NOT EXISTS market_redeems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ext TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  cedula TEXT,
  telefono TEXT,
  bank_code TEXT,
  bank_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  meta JSONB
);
CREATE INDEX IF NOT EXISTS market_redeems_status_created_idx ON market_redeems(status, created_at DESC);
CREATE INDEX IF NOT EXISTS market_redeems_user_idx ON market_redeems(user_ext);
