-- ============================================
-- BINGO V2 - COMPLETE REWRITE
-- Date: 2025-10-31
-- Description: Drop old tables and create v2 schema
-- ============================================

-- 1. DROP OLD TABLES (CASCADE to remove all dependencies)
DROP TABLE IF EXISTS bingo_audit_logs CASCADE;
DROP TABLE IF EXISTS bingo_drawn_numbers CASCADE;
DROP TABLE IF EXISTS bingo_cards CASCADE;
DROP TABLE IF EXISTS bingo_rooms CASCADE;

-- 2. CREATE NEW SCHEMA FOR BINGO V2

-- ============================================
-- USERS TABLE UPDATES (Add experience)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_won INTEGER DEFAULT 0;

-- ============================================
-- BINGO V2 ROOMS
-- ============================================
CREATE TABLE bingo_v2_rooms (
    id SERIAL PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id),
    
    -- Configuration
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('75', '90')),
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('line', 'corners', 'fullcard')),
    is_public BOOLEAN DEFAULT true,
    max_players INTEGER DEFAULT 10 CHECK (max_players >= 2 AND max_players <= 30),
    max_cards_per_player INTEGER DEFAULT 5 CHECK (max_cards_per_player >= 1 AND max_cards_per_player <= 10),
    
    -- Economy
    currency_type VARCHAR(10) NOT NULL CHECK (currency_type IN ('coins', 'fires')),
    card_cost DECIMAL(10, 2) NOT NULL CHECK (card_cost >= 0),
    total_pot DECIMAL(10, 2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished', 'cancelled')),
    
    -- Auto-mode settings
    auto_call_enabled BOOLEAN DEFAULT false,
    auto_call_interval INTEGER DEFAULT 5, -- seconds
    next_auto_call_at TIMESTAMP,
    
    -- Current game state
    current_game_number INTEGER DEFAULT 0,
    last_called_number INTEGER,
    drawn_numbers JSONB DEFAULT '[]'::jsonb,
    winner_id UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP
);

-- ============================================
-- BINGO V2 ROOM PLAYERS
-- ============================================
CREATE TABLE bingo_v2_room_players (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Player status
    is_ready BOOLEAN DEFAULT false,
    is_connected BOOLEAN DEFAULT true,
    last_activity TIMESTAMP DEFAULT NOW(),
    
    -- Economy
    cards_purchased INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    winnings DECIMAL(10, 2) DEFAULT 0,
    
    -- Join/leave tracking
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    
    -- Unique constraint: one player per room
    UNIQUE(room_id, user_id)
);

-- ============================================
-- BINGO V2 CARDS
-- ============================================
CREATE TABLE bingo_v2_cards (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES bingo_v2_room_players(id) ON DELETE CASCADE,
    card_number INTEGER NOT NULL, -- Card # for this player (1, 2, 3...)
    
    -- Card data
    grid JSONB NOT NULL, -- 2D array of numbers
    marked_numbers JSONB DEFAULT '[]'::jsonb, -- Array of marked numbers
    marked_positions JSONB DEFAULT '[]'::jsonb, -- Array of {row, col} positions
    
    -- Status
    has_bingo BOOLEAN DEFAULT false,
    pattern_completed VARCHAR(20),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    -- Unique constraint
    UNIQUE(room_id, player_id, card_number)
);

-- ============================================
-- BINGO V2 DRAWS (History of drawn numbers)
-- ============================================
CREATE TABLE bingo_v2_draws (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    draw_order INTEGER NOT NULL,
    drawn_by UUID REFERENCES users(id), -- Who drew it (host or admin)
    drawn_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(room_id, number),
    UNIQUE(room_id, draw_order)
);

-- ============================================
-- BINGO V2 AUDIT LOGS
-- ============================================
CREATE TABLE bingo_v2_audit_logs (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES bingo_v2_rooms(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BINGO V2 ROOM CHAT MESSAGES
-- ============================================
CREATE TABLE bingo_v2_room_chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BINGO V2 USER MESSAGES (Buzón)
-- ============================================
CREATE TABLE bingo_v2_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    category VARCHAR(20) NOT NULL CHECK (category IN ('system', 'friends')),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB, -- Extra data like game results
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to generate unique room code
CREATE OR REPLACE FUNCTION generate_room_code() RETURNS VARCHAR(6) AS $$
DECLARE
    new_code VARCHAR(6);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 6-digit code
        new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        -- Check if exists
        SELECT EXISTS(SELECT 1 FROM bingo_v2_rooms WHERE code = new_code) INTO code_exists;
        
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up abandoned rooms
CREATE OR REPLACE FUNCTION cleanup_abandoned_rooms() RETURNS void AS $$
BEGIN
    -- Update rooms where all players have been inactive for > 5 minutes
    UPDATE bingo_v2_rooms
    SET status = 'cancelled'
    WHERE status IN ('waiting', 'in_progress')
    AND NOT EXISTS (
        SELECT 1 FROM bingo_v2_room_players
        WHERE room_id = bingo_v2_rooms.id
        AND last_activity > NOW() - INTERVAL '5 minutes'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Rooms indexes
CREATE INDEX idx_bingo_v2_rooms_code ON bingo_v2_rooms(code);
CREATE INDEX idx_bingo_v2_rooms_host ON bingo_v2_rooms(host_id);
CREATE INDEX idx_bingo_v2_rooms_status ON bingo_v2_rooms(status);
CREATE INDEX idx_bingo_v2_rooms_created ON bingo_v2_rooms(created_at);
CREATE INDEX idx_bingo_v2_rooms_active ON bingo_v2_rooms(status, created_at DESC) 
    WHERE status IN ('waiting', 'in_progress');

-- Room players indexes
CREATE INDEX idx_bingo_v2_players_room ON bingo_v2_room_players(room_id);
CREATE INDEX idx_bingo_v2_players_user ON bingo_v2_room_players(user_id);
CREATE INDEX idx_bingo_v2_players_active ON bingo_v2_room_players(room_id, is_connected) 
    WHERE is_connected = true;

-- Cards indexes
CREATE INDEX idx_bingo_v2_cards_room ON bingo_v2_cards(room_id);
CREATE INDEX idx_bingo_v2_cards_player ON bingo_v2_cards(player_id);

-- Draws indexes
CREATE INDEX idx_bingo_v2_draws_room ON bingo_v2_draws(room_id);
CREATE INDEX idx_bingo_v2_draws_order ON bingo_v2_draws(draw_order);

-- Audit logs indexes
CREATE INDEX idx_bingo_v2_audit_room ON bingo_v2_audit_logs(room_id);
CREATE INDEX idx_bingo_v2_audit_user ON bingo_v2_audit_logs(user_id);
CREATE INDEX idx_bingo_v2_audit_created ON bingo_v2_audit_logs(created_at);

-- Chat messages indexes
CREATE INDEX idx_bingo_v2_chat_room ON bingo_v2_room_chat_messages(room_id);
CREATE INDEX idx_bingo_v2_chat_created ON bingo_v2_room_chat_messages(created_at DESC);

-- User messages indexes
CREATE INDEX idx_bingo_v2_messages_user ON bingo_v2_messages(user_id);
CREATE INDEX idx_bingo_v2_messages_unread ON bingo_v2_messages(user_id, is_read);
CREATE INDEX idx_bingo_v2_messages_created ON bingo_v2_messages(created_at DESC);
CREATE INDEX idx_bingo_v2_messages_recent ON bingo_v2_messages(user_id, created_at DESC) 
    WHERE is_read = false;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Grant permissions if needed (adjust based on your user setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

COMMENT ON TABLE bingo_v2_rooms IS 'Bingo V2 - Complete rewrite with improved structure';
COMMENT ON TABLE bingo_v2_room_players IS 'Players in each bingo room';
COMMENT ON TABLE bingo_v2_cards IS 'Bingo cards for each player';
COMMENT ON TABLE bingo_v2_draws IS 'History of drawn numbers';
COMMENT ON TABLE bingo_v2_audit_logs IS 'Audit trail for all bingo actions';
COMMENT ON TABLE bingo_v2_room_chat_messages IS 'Chat messages within rooms';
COMMENT ON TABLE bingo_v2_messages IS 'User message inbox system';
