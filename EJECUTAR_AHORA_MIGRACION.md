# 🚨 URGENTE: EJECUTAR MIGRACIÓN SQL AHORA

## ❌ ERROR ACTUAL

```
Tictactoe table not found in active games
Tictactoe table not found
```

**La página de Games y el lobby de TicTacToe no funcionan porque las tablas no existen.**

---

## ✅ SOLUCIÓN: EJECUTAR SQL AHORA

### PASO 1: Abrir Railway PostgreSQL

1. Ve a: https://railway.app/
2. Selecciona tu proyecto
3. Click en "PostgreSQL"
4. Click en "Query" (o "Data")

### PASO 2: Ejecutar el contenido completo de:

```
MIGRACION_LA_VIEJA.sql
```

**⚠️ IMPORTANTE: Ejecuta TODO el archivo completo de una sola vez.**

### PASO 3: Verificar que se crearon las tablas

```sql
-- Ejecuta esto para verificar:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'tictactoe%';

-- Deberías ver 3 tablas:
-- tictactoe_rooms
-- tictactoe_moves
-- tictactoe_stats
```

---

## 🔍 CONTENIDO A EJECUTAR (MIGRACION_LA_VIEJA.sql)

Si no encuentras el archivo, aquí está el contenido completo:

```sql
-- ==================================================
-- MIGRACIÓN: JUEGO LA VIEJA (TIC-TAC-TOE)
-- ==================================================

-- Tabla principal de salas
CREATE TABLE IF NOT EXISTS tictactoe_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('coins', 'fires')),
  bet_amount DECIMAL(10, 2) NOT NULL,
  visibility VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  
  -- Players
  player_x_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player_o_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player_x_ready BOOLEAN DEFAULT FALSE,
  player_o_ready BOOLEAN DEFAULT FALSE,
  
  -- Game state
  board TEXT DEFAULT '000000000', -- 9 positions: 0=empty, 1=X, 2=O
  current_turn VARCHAR(1) DEFAULT 'X' CHECK (current_turn IN ('X', 'O')),
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner VARCHAR(1) CHECK (winner IN ('X', 'O')),
  is_draw BOOLEAN DEFAULT FALSE,
  winning_line JSONB, -- {type: 'row'|'col'|'diag', index: 0-2}
  
  -- Timer (15 segundos por turno)
  time_left_seconds INTEGER DEFAULT 15,
  last_move_at TIMESTAMP,
  
  -- Prizes & Economy
  total_pot DECIMAL(10, 2) NOT NULL,
  winner_prize DECIMAL(10, 2),
  prize_distributed BOOLEAN DEFAULT FALSE,
  xp_awarded BOOLEAN DEFAULT FALSE,
  
  -- Rematch system
  rematch_requested_by_x BOOLEAN DEFAULT FALSE,
  rematch_requested_by_o BOOLEAN DEFAULT FALSE,
  rematch_count INTEGER DEFAULT 0,
  original_room_id UUID REFERENCES tictactoe_rooms(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_players_different CHECK (player_x_id != player_o_id),
  CONSTRAINT check_bet_amount CHECK (bet_amount > 0)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tictactoe_code ON tictactoe_rooms(code);
CREATE INDEX IF NOT EXISTS idx_tictactoe_status ON tictactoe_rooms(status);
CREATE INDEX IF NOT EXISTS idx_tictactoe_visibility ON tictactoe_rooms(visibility);
CREATE INDEX IF NOT EXISTS idx_tictactoe_player_x ON tictactoe_rooms(player_x_id);
CREATE INDEX IF NOT EXISTS idx_tictactoe_player_o ON tictactoe_rooms(player_o_id);
CREATE INDEX IF NOT EXISTS idx_tictactoe_created ON tictactoe_rooms(created_at DESC);

-- Tabla de movimientos (auditoría)
CREATE TABLE IF NOT EXISTS tictactoe_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES tictactoe_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(1) NOT NULL CHECK (symbol IN ('X', 'O')),
  row INTEGER NOT NULL CHECK (row >= 0 AND row <= 2),
  col INTEGER NOT NULL CHECK (col >= 0 AND col <= 2),
  time_taken_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_room ON tictactoe_moves(room_id);
CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_player ON tictactoe_moves(player_id);

-- Tabla de estadísticas
CREATE TABLE IF NOT EXISTS tictactoe_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_games INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_draws INTEGER DEFAULT 0,
  total_coins_won DECIMAL(10, 2) DEFAULT 0,
  total_coins_lost DECIMAL(10, 2) DEFAULT 0,
  total_fires_won DECIMAL(10, 2) DEFAULT 0,
  total_fires_lost DECIMAL(10, 2) DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  best_win_streak INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tictactoe_stats_user ON tictactoe_stats(user_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_tictactoe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tictactoe_rooms_updated_at
BEFORE UPDATE ON tictactoe_rooms
FOR EACH ROW
EXECUTE FUNCTION update_tictactoe_updated_at();

CREATE TRIGGER tictactoe_stats_updated_at
BEFORE UPDATE ON tictactoe_stats
FOR EACH ROW
EXECUTE FUNCTION update_tictactoe_updated_at();

-- Función para limpiar salas antiguas (cron job)
CREATE OR REPLACE FUNCTION cleanup_old_tictactoe_rooms()
RETURNS void AS $$
BEGIN
  -- Cancelar salas en waiting de más de 1 hora
  UPDATE tictactoe_rooms
  SET status = 'cancelled'
  WHERE status = 'waiting'
  AND created_at < NOW() - INTERVAL '1 hour';
  
  -- Cancelar salas en playing sin movimientos de más de 5 minutos
  UPDATE tictactoe_rooms
  SET status = 'cancelled'
  WHERE status = 'playing'
  AND last_move_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON TABLE tictactoe_rooms IS 'Salas del juego La Vieja (Tic-Tac-Toe) con timer de 15 segundos';
COMMENT ON TABLE tictactoe_moves IS 'Auditoría de movimientos de La Vieja';
COMMENT ON TABLE tictactoe_stats IS 'Estadísticas de jugadores de La Vieja';
COMMENT ON COLUMN tictactoe_rooms.time_left_seconds IS 'Tiempo restante del turno actual (15 seg inicial)';
COMMENT ON COLUMN tictactoe_rooms.rematch_count IS 'Número de revanchas consecutivas';
```

---

## ✅ DESPUÉS DE EJECUTAR LA MIGRACIÓN

### Los siguientes endpoints funcionarán:

1. `GET /api/games/list` - Mostrará "La Vieja" en la lista
2. `GET /api/games/active` - Contará salas activas
3. `GET /api/tictactoe/rooms/public` - Listará salas públicas
4. `POST /api/tictactoe/create` - Creará salas
5. `POST /api/tictactoe/join/:code` - Unirse a salas

### La página funcionará:

- ✅ `/games` - Mostrará "La Vieja" con 0 salas activas
- ✅ `/tictactoe/lobby` - Lobby funcionará sin errores
- ✅ Crear y jugar partidas

---

## 🔥 DESPUÉS DE LA MIGRACIÓN: DAR FIRES AL USUARIO

Como tu balance es **4.75 fires**, ya puedes crear salas una vez que:

1. ✅ Ejecutes la migración SQL
2. ✅ Railway complete el nuevo deploy (~2 min)
3. ✅ Refresques la página (Ctrl+Shift+R)

**Entonces podrás crear hasta 4 salas en modo Fires.**

---

## ⚠️ ESTO ES CRÍTICO

**Sin ejecutar esta migración SQL:**
- ❌ La página /games seguirá fallando
- ❌ El lobby de TicTacToe no funcionará
- ❌ No podrás crear ni unirte a salas

**Después de ejecutarla:**
- ✅ Todo funcionará correctamente
- ✅ Podrás crear y jugar partidas
- ✅ Las estadísticas se registrarán automáticamente

---

**EJECUTA EL SQL EN RAILWAY AHORA** 🚨
