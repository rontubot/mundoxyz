-- Welcome Events
CREATE TABLE IF NOT EXISTS welcome_events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  fires INTEGER NOT NULL DEFAULT 0,
  duration_hours INTEGER NOT NULL DEFAULT 24,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS welcome_event_history (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS welcome_event_claims (
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  user_ext TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(event_id, user_ext)
);

CREATE INDEX IF NOT EXISTS welcome_events_active_idx ON welcome_events(active);
CREATE INDEX IF NOT EXISTS welcome_event_history_event_idx ON welcome_event_history(event_id);
