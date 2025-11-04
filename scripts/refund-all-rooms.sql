-- ============================================================
-- SCRIPT DE CIERRE Y REEMBOLSO MASIVO DE SALAS ACTIVAS
-- Fecha: 2 Noviembre 2025
-- Descripción: Cierra todas las salas activas y reembolsa a jugadores
-- IMPORTANTE: Ejecutar en Railway con precaución
-- ============================================================

BEGIN;

-- PASO 1: Verificar salas activas
SELECT 
    r.id,
    r.code,
    r.status,
    r.currency_type,
    u.username as host_name,
    COUNT(DISTINCT p.id) FILTER (WHERE p.cards_purchased > 0) as players_with_cards,
    COALESCE(SUM(p.total_spent) FILTER (WHERE p.cards_purchased > 0), 0) as total_to_refund,
    r.prize_pool
FROM bingo_v2_rooms r
LEFT JOIN users u ON r.host_id = u.id
LEFT JOIN bingo_v2_room_players p ON r.id = p.room_id
WHERE r.status IN ('waiting', 'in_progress')
GROUP BY r.id, r.code, r.status, r.currency_type, r.host_id, u.username
ORDER BY r.status, r.code;

-- PASO 2: Crear tabla temporal con jugadores a reembolsar
CREATE TEMP TABLE players_to_refund AS
SELECT 
    r.id as room_id,
    r.code as room_code,
    r.status as room_status,
    r.currency_type,
    r.host_id,
    p.id as player_id,
    p.user_id,
    p.total_spent,
    u.username
FROM bingo_v2_rooms r
INNER JOIN bingo_v2_room_players p ON r.id = p.room_id
LEFT JOIN users u ON p.user_id = u.id
WHERE r.status IN ('waiting', 'in_progress')
  AND p.cards_purchased > 0
  AND p.total_spent > 0;

-- Verificar cuántos reembolsos se harán
SELECT 
    COUNT(*) as total_refunds,
    SUM(total_spent) as total_amount,
    currency_type
FROM players_to_refund
GROUP BY currency_type;

-- PASO 3: Reembolsar a wallets (COINS)
UPDATE wallets w
SET coins_balance = coins_balance + ptr.total_spent
FROM players_to_refund ptr
WHERE w.user_id = ptr.user_id
  AND ptr.currency_type = 'coins';

-- PASO 4: Reembolsar a wallets (FIRES)
UPDATE wallets w
SET fires_balance = fires_balance + ptr.total_spent
FROM players_to_refund ptr
WHERE w.user_id = ptr.user_id
  AND ptr.currency_type = 'fires';

-- PASO 5: Registrar reembolsos en tabla
INSERT INTO bingo_v2_refunds 
    (room_id, player_id, user_id, amount, currency_type, reason, refunded_by, notes, refunded_at)
SELECT 
    ptr.room_id,
    ptr.player_id,
    ptr.user_id,
    ptr.total_spent,
    ptr.currency_type,
    'admin_forced',
    NULL,
    'Cierre masivo automatizado - ' || ptr.room_code,
    NOW()
FROM players_to_refund ptr;

-- PASO 6: Enviar mensajes al buzón
INSERT INTO bingo_v2_messages 
    (user_id, category, title, content, metadata, created_at)
SELECT 
    ptr.user_id,
    'system',
    'Reembolso de Bingo',
    'Sala #' || ptr.room_code || ' fue cerrada. Has recibido un reembolso de ' || 
    ptr.total_spent || ' ' || ptr.currency_type || '.',
    jsonb_build_object(
        'room_code', ptr.room_code,
        'amount', ptr.total_spent,
        'currency', ptr.currency_type,
        'reason', 'admin_forced',
        'timestamp', NOW()
    ),
    NOW()
FROM players_to_refund ptr;

-- PASO 7: Actualizar estado de salas a cancelled
UPDATE bingo_v2_rooms r
SET 
    status = 'cancelled',
    finished_at = NOW(),
    is_stalled = false
WHERE r.status IN ('waiting', 'in_progress');

-- PASO 8: Registrar en audit logs
INSERT INTO bingo_v2_audit_logs 
    (room_id, action, user_id, details, created_at)
SELECT 
    r.id,
    'room_cancelled',
    r.host_id,
    jsonb_build_object(
        'reason', 'admin_forced',
        'automated_script', true,
        'timestamp', NOW(),
        'refunded_count', (
            SELECT COUNT(*) 
            FROM players_to_refund ptr 
            WHERE ptr.room_id = r.id
        )
    ),
    NOW()
FROM bingo_v2_rooms r
WHERE r.status = 'cancelled' 
  AND r.finished_at = NOW();

-- PASO 9: Resumen final
SELECT 
    'RESUMEN FINAL' as titulo,
    (SELECT COUNT(*) FROM bingo_v2_rooms WHERE status = 'cancelled' AND finished_at::date = CURRENT_DATE) as salas_cerradas,
    (SELECT COUNT(*) FROM bingo_v2_refunds WHERE refunded_at::date = CURRENT_DATE) as jugadores_reembolsados,
    (SELECT SUM(amount) FROM bingo_v2_refunds WHERE refunded_at::date = CURRENT_DATE AND currency_type = 'coins') as total_coins_reembolsados,
    (SELECT SUM(amount) FROM bingo_v2_refunds WHERE refunded_at::date = CURRENT_DATE AND currency_type = 'fires') as total_fires_reembolsados;

-- IMPORTANTE: Revisar todo antes de hacer COMMIT
-- Si todo se ve bien: COMMIT;
-- Si algo está mal: ROLLBACK;

COMMIT;

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
