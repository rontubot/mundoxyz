-- Core: roles, users, auth_identities, user_roles, wallets, wallet_transactions, user_sessions, connection_logs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xyz_id VARCHAR(64) UNIQUE,
  tg_id BIGINT UNIQUE,
  username VARCHAR(64),
  display_name VARCHAR(128),
  email VARCHAR(128) UNIQUE,
  phone VARCHAR(32),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  provider_uid VARCHAR(128) NOT NULL,
  password_hash TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_uid)
);
CREATE INDEX IF NOT EXISTS auth_identities_user_id_idx ON auth_identities(user_id);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  fires_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  coins_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  amount_fire NUMERIC(18,2) DEFAULT 0,
  amount_coin NUMERIC(18,2) DEFAULT 0,
  reference TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wallet_tx_wallet_created_idx ON wallet_transactions(wallet_id, created_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  ip VARCHAR(64),
  ua TEXT,
  data JSONB
);
CREATE INDEX IF NOT EXISTS user_sessions_user_created_idx ON user_sessions(user_id, created_at);

CREATE TABLE IF NOT EXISTS connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ts TIMESTAMPTZ DEFAULT NOW(),
  ua TEXT,
  platform VARCHAR(64),
  ip VARCHAR(64),
  meta JSONB
);
CREATE INDEX IF NOT EXISTS connection_logs_user_ts_idx ON connection_logs(user_id, ts);
