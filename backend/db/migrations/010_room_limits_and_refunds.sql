-- Migración 010: Sistema de límites de salas, autocanto automático y reembolsos
-- Fecha: 2 Nov 2025

BEGIN;

-- 1. Agregar columnas para tracking de actividad y fallas
ALTER TABLE bingo_v2_rooms 
  ADD COLUMN IF NOT EXISTS is_stalled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS auto_call_forced BOOLEAN DEFAULT FALSE;

-- 2. Crear índices para optimizar queries de límites
CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_host_status 
  ON bingo_v2_rooms(host_id, status) 
  WHERE status IN ('waiting', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_activity 
  ON bingo_v2_rooms(last_activity_at, status) 
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_stalled 
  ON bingo_v2_rooms(is_stalled) 
  WHERE is_stalled = TRUE;

-- 3. Tabla para registro de reembolsos (historial)
CREATE TABLE IF NOT EXISTS bingo_v2_refunds (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES bingo_v2_room_players(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency_type VARCHAR(10) NOT NULL CHECK (currency_type IN ('coins', 'fires')),
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('host_closed', 'system_failure', 'admin_forced', 'timeout')),
  refunded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  refunded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_refunds_room ON bingo_v2_refunds(room_id);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_refunds_user ON bingo_v2_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_refunds_date ON bingo_v2_refunds(refunded_at DESC);

-- 4. Actualizar last_activity_at en salas existentes
UPDATE bingo_v2_rooms 
SET last_activity_at = COALESCE(last_called_at, started_at, created_at)
WHERE last_activity_at IS NULL;

-- 5. Trigger para actualizar last_activity_at automáticamente
CREATE OR REPLACE FUNCTION update_room_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_room_activity ON bingo_v2_rooms;
CREATE TRIGGER trigger_update_room_activity
  BEFORE UPDATE OF last_called_number, drawn_numbers ON bingo_v2_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_room_activity();

COMMIT;
