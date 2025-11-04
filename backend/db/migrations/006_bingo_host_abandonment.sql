-- ============================================
-- MIGRACIÓN: Sistema de Abandono de Host en Bingo
-- Versión: 006
-- Fecha: 30 Octubre 2025
-- ============================================

-- Agregar campos para manejo de abandono del host
ALTER TABLE bingo_rooms
ADD COLUMN IF NOT EXISTS host_abandoned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS substitute_host_id UUID, -- Referencia a users(id) sin FK por ahora
ADD COLUMN IF NOT EXISTS host_last_activity TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS abandonment_detected_at TIMESTAMP;

-- Índices para consultas de salas abandonadas
CREATE INDEX IF NOT EXISTS idx_bingo_rooms_host_abandoned 
ON bingo_rooms(host_abandoned) WHERE host_abandoned = TRUE;

CREATE INDEX IF NOT EXISTS idx_bingo_rooms_host_activity 
ON bingo_rooms(host_last_activity) WHERE status = 'playing';

-- Comentarios para documentación
COMMENT ON COLUMN bingo_rooms.host_abandoned IS 'Indica si el host abandonó la sala durante el juego';
COMMENT ON COLUMN bingo_rooms.substitute_host_id IS 'Admin/Tote que toma control de sala abandonada';
COMMENT ON COLUMN bingo_rooms.host_last_activity IS 'Última actividad del host (cantar número o socket activo)';
COMMENT ON COLUMN bingo_rooms.abandonment_detected_at IS 'Timestamp cuando se detectó el abandono';

-- Trigger para actualizar host_last_activity automáticamente
CREATE OR REPLACE FUNCTION update_bingo_host_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar host_last_activity cuando se canta un número
  IF TG_TABLE_NAME = 'bingo_drawn_numbers' THEN
    UPDATE bingo_rooms 
    SET host_last_activity = NOW() 
    WHERE id = NEW.room_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_host_activity ON bingo_drawn_numbers;
CREATE TRIGGER trigger_update_host_activity
AFTER INSERT ON bingo_drawn_numbers
FOR EACH ROW
EXECUTE FUNCTION update_bingo_host_activity();

-- Tabla de notificaciones de abandono (para tracking)
-- NOTA: Sin foreign key por incompatibilidad de tipos en producción
CREATE TABLE IF NOT EXISTS bingo_abandonment_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id INTEGER, -- Referencia a bingo_rooms(id) sin FK por ahora
  notified_user_id UUID, -- Referencia a users(id) sin FK por ahora
  notification_type VARCHAR(50) DEFAULT 'telegram',
  notification_status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  room_link TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abandonment_notifications_room 
ON bingo_abandonment_notifications(room_id);

CREATE INDEX IF NOT EXISTS idx_abandonment_notifications_status 
ON bingo_abandonment_notifications(notification_status) 
WHERE notification_status = 'pending';

COMMENT ON TABLE bingo_abandonment_notifications IS 'Registro de notificaciones enviadas cuando host abandona sala';

-- Vista para monitoreo de salas con riesgo de abandono
CREATE OR REPLACE VIEW bingo_rooms_at_risk AS
SELECT 
  r.id,
  r.code,
  r.host_id,
  r.status,
  r.host_last_activity,
  EXTRACT(EPOCH FROM (NOW() - r.host_last_activity)) as seconds_since_activity,
  r.pot_total,
  r.currency,
  COUNT(p.user_id) as player_count,
  u.username as host_username,
  u.tg_id as host_tg_id
FROM bingo_rooms r
JOIN users u ON u.id = r.host_id
LEFT JOIN bingo_room_players p ON p.room_id = r.id
WHERE r.status = 'playing'
  AND r.host_abandoned = FALSE
  AND r.host_last_activity < NOW() - INTERVAL '4 minutes' -- Alerta previa
GROUP BY r.id, u.username, u.tg_id;

COMMENT ON VIEW bingo_rooms_at_risk IS 'Salas en riesgo de abandono (>4 min sin actividad del host)';

-- Log de auditoría para cambios de host
ALTER TABLE bingo_audit_logs
ADD COLUMN IF NOT EXISTS old_host_id UUID,
ADD COLUMN IF NOT EXISTS new_host_id UUID;

-- Insertar log inicial
INSERT INTO bingo_audit_logs (room_id, user_id, action, details)
SELECT 
  id,
  NULL,
  'migration_006_applied',
  '{"migration": "host_abandonment_system", "version": "006"}'::jsonb
FROM bingo_rooms
WHERE status IN ('lobby', 'waiting', 'ready', 'playing')
ON CONFLICT DO NOTHING;

-- ============================================
-- RESUMEN DE CAMBIOS
-- ============================================
-- ✅ Agregados campos: host_abandoned, substitute_host_id, host_last_activity
-- ✅ Trigger automático para actualizar host_last_activity
-- ✅ Tabla de notificaciones de abandono
-- ✅ Vista de monitoreo de salas en riesgo
-- ✅ Índices para optimizar consultas
-- ✅ Auditoría extendida para cambios de host
