-- Migration 009: Add last_called_at column for rate limiting
-- Date: 2025-11-01

-- Add last_called_at column to bingo_v2_rooms
ALTER TABLE bingo_v2_rooms 
ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMP;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_last_called_at 
ON bingo_v2_rooms(last_called_at);
