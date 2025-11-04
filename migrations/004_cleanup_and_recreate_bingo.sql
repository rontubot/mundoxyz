-- ============================================
-- LIMPIEZA Y RECREACIÓN DEL SISTEMA DE BINGO
-- ============================================
-- Descripción: Elimina tablas antiguas de bingo y crea el sistema nuevo
-- Autor: MUNDOXYZ Team
-- Fecha: 2025-10-27
-- ============================================

-- 1. ELIMINAR TABLAS ANTIGUAS (si existen)
-- ============================================
DROP TABLE IF EXISTS bingo_claims CASCADE;
DROP TABLE IF EXISTS bingo_draws CASCADE;
DROP TABLE IF EXISTS bingo_players CASCADE;
DROP TABLE IF EXISTS bingo_cards CASCADE;
DROP TABLE IF EXISTS bingo_rooms CASCADE;

-- 2. ELIMINAR ÍNDICES ANTIGUOS (si existen)
-- ============================================
-- Eliminar cualquier índice que empiece con idx_bingo_
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_bingo_%')
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || r.indexname;
    END LOOP;
END $$;

-- También eliminar índices específicos conocidos
DROP INDEX IF EXISTS idx_bingo_rooms_code;
DROP INDEX IF EXISTS idx_bingo_rooms_host;
DROP INDEX IF EXISTS idx_bingo_rooms_status;
DROP INDEX IF EXISTS idx_bingo_rooms_visibility;
DROP INDEX IF EXISTS idx_bingo_cards_room;
DROP INDEX IF EXISTS idx_bingo_cards_player;
DROP INDEX IF EXISTS idx_bingo_cards_winner;
DROP INDEX IF EXISTS idx_bingo_draws_room;
DROP INDEX IF EXISTS idx_bingo_draws_order;
DROP INDEX IF EXISTS idx_bingo_drawn_room;
DROP INDEX IF EXISTS idx_bingo_drawn_numbers;
DROP INDEX IF EXISTS idx_bingo_drawn_sequence;
DROP INDEX IF EXISTS idx_bingo_drawn_recent;
DROP INDEX IF EXISTS idx_bingo_players_room;
DROP INDEX IF EXISTS idx_bingo_players_user;
DROP INDEX IF EXISTS idx_bingo_players_status;
DROP INDEX IF EXISTS idx_bingo_players_connected;
DROP INDEX IF EXISTS idx_bingo_claims_room;
DROP INDEX IF EXISTS idx_bingo_claims_player;
DROP INDEX IF EXISTS idx_bingo_claims_status;
DROP INDEX IF EXISTS idx_bingo_transactions_room;
DROP INDEX IF EXISTS idx_bingo_transactions_player;
DROP INDEX IF EXISTS idx_bingo_trans_room;
DROP INDEX IF EXISTS idx_bingo_trans_player;
DROP INDEX IF EXISTS idx_bingo_winners_room;
DROP INDEX IF EXISTS idx_bingo_audit_logs_room;
DROP INDEX IF EXISTS idx_bingo_game_stats_room;
DROP INDEX IF EXISTS idx_bingo_game_stats_player;
DROP INDEX IF EXISTS idx_bingo_prize_distribution_room;
DROP INDEX IF EXISTS idx_bingo_prize_distribution_winner;
DROP INDEX IF EXISTS idx_bingo_room_stats;
DROP INDEX IF EXISTS idx_bingo_player_stats;
DROP INDEX IF EXISTS idx_bingo_session_room;
DROP INDEX IF EXISTS idx_bingo_session_player;
DROP INDEX IF EXISTS idx_bingo_payment_room;
DROP INDEX IF EXISTS idx_bingo_payment_player;
DROP INDEX IF EXISTS idx_bingo_referral_room;
DROP INDEX IF EXISTS idx_bingo_referral_player;

-- 3. CREAR NUEVAS TABLAS CON ESTRUCTURA CORRECTA
-- ============================================

-- TABLA PRINCIPAL: SALAS DE BINGO
CREATE TABLE IF NOT EXISTS bingo_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_name VARCHAR(100),
    room_type VARCHAR(10) NOT NULL CHECK (room_type IN ('public', 'private')),
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('coins', 'fires')),
    numbers_mode INTEGER NOT NULL CHECK (numbers_mode IN (75, 90)),
    victory_mode VARCHAR(20) NOT NULL CHECK (victory_mode IN ('line', 'corners', 'full')),
    card_cost DECIMAL(10,2) NOT NULL CHECK (card_cost > 0),
    max_players INTEGER DEFAULT 30 CHECK (max_players > 0 AND max_players <= 30),
    max_cards_per_player INTEGER DEFAULT 10 CHECK (max_cards_per_player > 0 AND max_cards_per_player <= 10),
    password VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'ready', 'playing', 'finished', 'cancelled')),
    pot_total DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE JUGADORES EN SALAS
CREATE TABLE IF NOT EXISTS bingo_room_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_host BOOLEAN DEFAULT FALSE,
    cards_owned INTEGER DEFAULT 0,
    ready_at TIMESTAMP WITH TIME ZONE,
    connected BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    wins INTEGER DEFAULT 0,
    payout DECIMAL(10,2) DEFAULT 0,
    UNIQUE(room_id, user_id)
);

-- TABLA DE CARTONES
CREATE TABLE IF NOT EXISTS bingo_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_number INTEGER NOT NULL,
    numbers JSONB NOT NULL,
    marked_numbers JSONB DEFAULT '[]'::jsonb,
    auto_marked JSONB DEFAULT '[]'::jsonb,
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE NÚMEROS CANTADOS
CREATE TABLE IF NOT EXISTS bingo_drawn_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    drawn_number INTEGER NOT NULL,
    drawn_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    drawn_by UUID NOT NULL REFERENCES users(id),
    UNIQUE(room_id, drawn_number),
    UNIQUE(room_id, sequence_number)
);

-- TABLA DE TRANSACCIONES DE BINGO
CREATE TABLE IF NOT EXISTS bingo_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_transaction_id UUID REFERENCES wallet_transactions(id),
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'room_creation',
        'card_purchase',
        'refund',
        'winner_payout',
        'host_commission',
        'platform_fee'
    )),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE GANADORES
CREATE TABLE IF NOT EXISTS bingo_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES bingo_cards(id) ON DELETE CASCADE,
    winning_pattern VARCHAR(20) NOT NULL,
    prize_amount DECIMAL(10,2) NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    validated BOOLEAN DEFAULT FALSE,
    validation_data JSONB
);

-- TABLA DE AUDITORÍA
CREATE TABLE IF NOT EXISTS bingo_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CREAR ÍNDICES OPTIMIZADOS
-- ============================================
CREATE INDEX idx_bingo_rooms_code ON bingo_rooms(code);
CREATE INDEX idx_bingo_rooms_status ON bingo_rooms(status);
CREATE INDEX idx_bingo_rooms_host ON bingo_rooms(host_id);
CREATE INDEX idx_bingo_rooms_created ON bingo_rooms(created_at DESC);
CREATE INDEX idx_bingo_rooms_active ON bingo_rooms(status, room_type) 
    WHERE status IN ('lobby', 'ready', 'playing');

CREATE INDEX idx_bingo_players_room ON bingo_room_players(room_id);
CREATE INDEX idx_bingo_players_user ON bingo_room_players(user_id);
CREATE INDEX idx_bingo_players_connected ON bingo_room_players(connected);

CREATE INDEX idx_bingo_cards_room ON bingo_cards(room_id);
CREATE INDEX idx_bingo_cards_owner ON bingo_cards(owner_id);
CREATE INDEX idx_bingo_cards_room_owner ON bingo_cards(room_id, owner_id);
CREATE INDEX idx_bingo_cards_winner ON bingo_cards(is_winner) WHERE is_winner = true;

CREATE INDEX idx_bingo_drawn_room ON bingo_drawn_numbers(room_id);
CREATE INDEX idx_bingo_drawn_sequence ON bingo_drawn_numbers(room_id, sequence_number);
CREATE INDEX idx_bingo_drawn_recent ON bingo_drawn_numbers(room_id, drawn_at DESC);

CREATE INDEX idx_bingo_trans_room ON bingo_transactions(room_id);
CREATE INDEX idx_bingo_trans_user ON bingo_transactions(user_id);
CREATE INDEX idx_bingo_trans_type ON bingo_transactions(type);
CREATE INDEX idx_bingo_trans_created ON bingo_transactions(created_at DESC);

CREATE INDEX idx_bingo_winners_room ON bingo_winners(room_id);
CREATE INDEX idx_bingo_winners_user ON bingo_winners(user_id);

CREATE INDEX idx_bingo_audit_room ON bingo_audit_logs(room_id);
CREATE INDEX idx_bingo_audit_user ON bingo_audit_logs(user_id);
CREATE INDEX idx_bingo_audit_action ON bingo_audit_logs(action);
CREATE INDEX idx_bingo_audit_created ON bingo_audit_logs(created_at DESC);

-- 5. FUNCIÓN PARA GENERAR CÓDIGO ÚNICO
-- ============================================
-- CORREGIDO: Usar new_code para evitar ambigüedad con columna bingo_rooms.code
-- Genera códigos de 6 dígitos numéricos (000000-999999) para facilitar acceso
CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
    new_code VARCHAR(6);
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    room_exists BOOLEAN;
BEGIN
    LOOP
        -- Generar código de 6 dígitos (000000 a 999999)
        new_code := LPAD(floor(random() * 1000000)::text, 6, '0');
        
        SELECT EXISTS(
            SELECT 1 FROM bingo_rooms WHERE code = new_code
        ) INTO room_exists;
        
        IF NOT room_exists THEN
            RETURN new_code;
        END IF;
        
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. TRIGGER PARA ACTUALIZAR last_activity
-- ============================================
CREATE OR REPLACE FUNCTION update_bingo_room_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE bingo_rooms 
    SET last_activity = CURRENT_TIMESTAMP 
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_on_draw ON bingo_drawn_numbers;
CREATE TRIGGER update_activity_on_draw
    AFTER INSERT ON bingo_drawn_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_bingo_room_activity();

DROP TRIGGER IF EXISTS update_activity_on_player_action ON bingo_room_players;
CREATE TRIGGER update_activity_on_player_action
    AFTER INSERT OR UPDATE ON bingo_room_players
    FOR EACH ROW
    EXECUTE FUNCTION update_bingo_room_activity();

-- 7. ESTADÍSTICAS DE BINGO EN user_stats
-- ============================================
-- Primero crear tabla user_stats si no existe
CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Luego agregar columnas específicas de bingo
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_games_played INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_games_won INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_total_earnings DECIMAL(10,2) DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_total_spent DECIMAL(10,2) DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_cards_completed INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_numbers_marked INTEGER DEFAULT 0;

-- 8. REGISTRAR MIGRACIÓN
-- ============================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, executed_at) 
VALUES ('004_cleanup_and_recreate_bingo', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================
