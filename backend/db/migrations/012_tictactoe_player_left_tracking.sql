-- Migración 012: Tracking de jugadores que abandonan sala de TicTacToe
-- Propósito: Mantener sala abierta hasta que AMBOS jugadores la abandonen

BEGIN;

-- Agregar campos para tracking de abandono
ALTER TABLE tictactoe_rooms 
ADD COLUMN IF NOT EXISTS player_x_left BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS player_o_left BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Índice para búsqueda eficiente de salas archivadas
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_archived 
ON tictactoe_rooms(archived_at) 
WHERE archived_at IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN tictactoe_rooms.player_x_left IS 'Indica si el jugador X abandonó la sala después de terminar';
COMMENT ON COLUMN tictactoe_rooms.player_o_left IS 'Indica si el jugador O abandonó la sala después de terminar';
COMMENT ON COLUMN tictactoe_rooms.archived_at IS 'Timestamp cuando ambos jugadores abandonaron y la sala se archivó';

COMMIT;
