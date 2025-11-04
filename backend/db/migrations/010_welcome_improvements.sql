-- Migración 010: Sistema de Fidelización Avanzado
-- Mejoras a eventos de bienvenida y sistema de regalos directos

-- Mejorar tabla welcome_events con configuración avanzada
ALTER TABLE welcome_events 
ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS recurrence VARCHAR(50),
ADD COLUMN IF NOT EXISTS target_segment JSONB DEFAULT '{"type": "all"}',
ADD COLUMN IF NOT EXISTS min_user_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_per_user INTEGER,
ADD COLUMN IF NOT EXISTS cooldown_hours INTEGER,
ADD COLUMN IF NOT EXISTS require_claim BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_send BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expires_hours INTEGER DEFAULT 72,
ADD COLUMN IF NOT EXISTS claimed_count INTEGER DEFAULT 0;

-- Comentarios para documentación
COMMENT ON COLUMN welcome_events.event_type IS 'Tipo: manual, daily, weekly, monthly, first_login, comeback';
COMMENT ON COLUMN welcome_events.target_segment IS 'JSON con filtros: {type: all|first_time|inactive|low_balance, days: X, level: X}';
COMMENT ON COLUMN welcome_events.require_claim IS 'Si true, usuario debe aceptar. Si false, se acredita automáticamente';

-- Nueva tabla para regalos directos (envío individual)
CREATE TABLE IF NOT EXISTS direct_gifts (
  id SERIAL PRIMARY KEY,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type VARCHAR(50) NOT NULL, -- 'single', 'all', 'first_time', 'inactive', 'low_balance'
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_segment JSONB DEFAULT '{}', -- Criterios de segmentación
  message TEXT NOT NULL,
  coins_amount DECIMAL(20,2) DEFAULT 0,
  fires_amount DECIMAL(20,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'claimed', 'expired', 'sent'
  expires_at TIMESTAMP,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (coins_amount >= 0 AND fires_amount >= 0),
  CHECK (coins_amount > 0 OR fires_amount > 0)
);

-- Nueva tabla para tracking de claims de regalos directos
CREATE TABLE IF NOT EXISTS direct_gift_claims (
  id SERIAL PRIMARY KEY,
  gift_id INTEGER REFERENCES direct_gifts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  coins_claimed DECIMAL(20,2) DEFAULT 0,
  fires_claimed DECIMAL(20,2) DEFAULT 0,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  
  UNIQUE(gift_id, user_id)
);

-- Tabla de analíticas de eventos (para tracking y ROI)
CREATE TABLE IF NOT EXISTS gift_analytics (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES welcome_events(id) ON DELETE CASCADE,
  gift_id INTEGER REFERENCES direct_gifts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'sent', 'viewed', 'claimed', 'expired', 'game_played_after'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CHECK (event_id IS NOT NULL OR gift_id IS NOT NULL)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_direct_gifts_target_user ON direct_gifts(target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_direct_gifts_status_expires ON direct_gifts(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_direct_gifts_sender ON direct_gifts(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_gifts_target_type ON direct_gifts(target_type, status);

CREATE INDEX IF NOT EXISTS idx_direct_gift_claims_user ON direct_gift_claims(user_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_gift_claims_gift ON direct_gift_claims(gift_id);

CREATE INDEX IF NOT EXISTS idx_gift_analytics_event ON gift_analytics(event_id, action);
CREATE INDEX IF NOT EXISTS idx_gift_analytics_user ON gift_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_analytics_action ON gift_analytics(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_welcome_events_type ON welcome_events(event_type, is_active);
CREATE INDEX IF NOT EXISTS idx_welcome_events_segment ON welcome_events USING gin(target_segment);

-- Vista para estadísticas de eventos
CREATE OR REPLACE VIEW welcome_event_stats AS
SELECT 
  we.id,
  we.name,
  we.event_type,
  we.is_active,
  we.coins_amount,
  we.fires_amount,
  we.max_claims,
  we.created_at,
  COUNT(DISTINCT wec.user_id) as total_claims,
  COALESCE(SUM(wec.coins_claimed), 0) as total_coins_distributed,
  COALESCE(SUM(wec.fires_claimed), 0) as total_fires_distributed,
  COUNT(DISTINCT CASE 
    WHEN ga.action = 'game_played_after' 
    AND ga.created_at > wec.claimed_at 
    THEN ga.user_id 
  END) as users_returned,
  CASE 
    WHEN COUNT(DISTINCT wec.user_id) > 0 
    THEN ROUND(COUNT(DISTINCT CASE 
      WHEN ga.action = 'game_played_after' 
      AND ga.created_at > wec.claimed_at 
      THEN ga.user_id 
    END)::numeric / COUNT(DISTINCT wec.user_id) * 100, 2)
    ELSE 0 
  END as return_rate
FROM welcome_events we
LEFT JOIN welcome_event_claims wec ON we.id = wec.event_id
LEFT JOIN gift_analytics ga ON we.id = ga.event_id AND ga.user_id = wec.user_id
GROUP BY we.id, we.name, we.event_type, we.is_active, we.coins_amount, 
         we.fires_amount, we.max_claims, we.created_at;

-- Vista para estadísticas de regalos directos
CREATE OR REPLACE VIEW direct_gift_stats AS
SELECT 
  dg.id,
  dg.target_type,
  dg.status,
  dg.coins_amount,
  dg.fires_amount,
  dg.created_at,
  u.username as sender_username,
  COUNT(DISTINCT dgc.user_id) as total_claims,
  COALESCE(SUM(dgc.coins_claimed), 0) as total_coins_claimed,
  COALESCE(SUM(dgc.fires_claimed), 0) as total_fires_claimed
FROM direct_gifts dg
LEFT JOIN users u ON dg.sender_id = u.id
LEFT JOIN direct_gift_claims dgc ON dg.id = dgc.gift_id
GROUP BY dg.id, dg.target_type, dg.status, dg.coins_amount, 
         dg.fires_amount, dg.created_at, u.username;

-- Trigger para actualizar claimed_count en welcome_events
CREATE OR REPLACE FUNCTION update_event_claimed_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE welcome_events 
  SET claimed_count = (
    SELECT COUNT(*) 
    FROM welcome_event_claims 
    WHERE event_id = NEW.event_id
  )
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_claimed_count
AFTER INSERT ON welcome_event_claims
FOR EACH ROW
EXECUTE FUNCTION update_event_claimed_count();

-- Función para expirar regalos automáticamente
CREATE OR REPLACE FUNCTION expire_old_gifts()
RETURNS void AS $$
BEGIN
  UPDATE direct_gifts
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE direct_gifts IS 'Regalos directos enviados por admin a usuarios específicos o segmentos';
COMMENT ON TABLE gift_analytics IS 'Analíticas de eventos y regalos para medir ROI y engagement';
COMMENT ON VIEW welcome_event_stats IS 'Estadísticas agregadas de eventos de bienvenida';
COMMENT ON VIEW direct_gift_stats IS 'Estadísticas agregadas de regalos directos';
