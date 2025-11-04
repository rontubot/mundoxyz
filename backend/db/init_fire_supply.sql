-- Inicializar tabla fire_supply si no existe

CREATE TABLE IF NOT EXISTS fire_supply (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_max DECIMAL(20, 2) NOT NULL DEFAULT 10000,
  total_emitted DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_burned DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_circulating DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_reserved DECIMAL(20, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insertar registro inicial si no existe
INSERT INTO fire_supply (id, total_max, total_emitted, total_burned, total_circulating, total_reserved)
VALUES (1, 10000, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Calcular valores reales basados en wallets existentes
UPDATE fire_supply 
SET 
  total_circulating = COALESCE((SELECT SUM(fires_balance) FROM wallets), 0),
  total_emitted = COALESCE((SELECT SUM(fires_balance) FROM wallets), 0) + COALESCE(total_burned, 0),
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;
