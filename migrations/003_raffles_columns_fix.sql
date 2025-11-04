-- ================================================================
-- FIX COLUMNAS ADICIONALES PARA RAFFLES
-- ================================================================
-- Este archivo agrega las columnas faltantes sin crear tablas duplicadas

DO $$
BEGIN
    -- Agregar columnas a raffles si no existen
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'raffles') THEN
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'type') THEN
            ALTER TABLE raffles ADD COLUMN type VARCHAR(20) DEFAULT 'public';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'is_company_mode') THEN
            ALTER TABLE raffles ADD COLUMN is_company_mode BOOLEAN DEFAULT FALSE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'company_cost') THEN
            ALTER TABLE raffles ADD COLUMN company_cost INTEGER DEFAULT 3000;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'close_type') THEN
            ALTER TABLE raffles ADD COLUMN close_type VARCHAR(20) DEFAULT 'auto_full';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'scheduled_close_at') THEN
            ALTER TABLE raffles ADD COLUMN scheduled_close_at TIMESTAMP;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'terms_conditions') THEN
            ALTER TABLE raffles ADD COLUMN terms_conditions TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'cost_per_number') THEN
            ALTER TABLE raffles ADD COLUMN cost_per_number INTEGER DEFAULT 10;
        END IF;
        
        RAISE NOTICE 'Columnas adicionales agregadas a raffles';
    END IF;
END $$;

-- ================================================================
-- CREAR TABLAS ADICIONALES si no existen
-- ================================================================

-- Tabla de empresas para rifas
CREATE TABLE IF NOT EXISTS raffle_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    brand_color VARCHAR(7) DEFAULT '#8B5CF6',
    website_url VARCHAR(500),
    rif_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de compras (reemplaza a raffle_tickets)
CREATE TABLE IF NOT EXISTS raffle_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number_id UUID NOT NULL REFERENCES raffle_numbers(id) ON DELETE CASCADE,
    number VARCHAR(10) NOT NULL,
    cost_amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'fires',
    purchase_type VARCHAR(20) DEFAULT 'fire',
    status VARCHAR(20) DEFAULT 'completed',
    payment_reference VARCHAR(255),
    purchase_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de solicitudes para modo premio
CREATE TABLE IF NOT EXISTS raffle_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(20) DEFAULT 'approval',
    status VARCHAR(20) DEFAULT 'pending',
    request_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ganadores
CREATE TABLE IF NOT EXISTS raffle_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    prize_amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'fires',
    winner_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- ÍNDICES CORREGIDOS (solo columnas que existen)
-- ================================================================

-- Índices para raffle_numbers (usando state, no status)
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_raffle_state ON raffle_numbers(raffle_id, state);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_reserved ON raffle_numbers(reserved_until, state);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_purchased ON raffle_numbers(owner_id, state);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_expires ON raffle_numbers(reserved_until) WHERE state = 'reserved';

-- Índices para raffles (status sí existe)
CREATE INDEX IF NOT EXISTS idx_raffles_host_status ON raffles(host_id, status);
CREATE INDEX IF NOT EXISTS idx_raffles_mode_type ON raffles(mode, COALESCE(type, visibility), status);

-- Índices para nuevas tablas
CREATE INDEX IF NOT EXISTS idx_raffle_companies_raffle_id ON raffle_companies(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_purchases_user_status ON raffle_purchases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_raffle_purchases_raffle_status ON raffle_purchases(raffle_id, status);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_raffle_status ON raffle_requests(raffle_id, status);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_user ON raffle_requests(user_id, status);

-- ================================================================
-- FUNCIÓN PARA CÓDIGOS NUMÉRICOS
-- ================================================================
CREATE OR REPLACE FUNCTION generate_unique_raffle_code()
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
    new_code VARCHAR(6);
    code_exists BOOLEAN;
BEGIN
    -- Generar código numérico de 6 dígitos
    LOOP
        new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        -- Verificar si ya existe
        SELECT EXISTS(SELECT 1 FROM raffles WHERE code = new_code) INTO code_exists;
        
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$;

-- ================================================================
-- ACTUALIZAR TRIGGER PARA USAR NUEVA FUNCIÓN
-- ================================================================
CREATE OR REPLACE FUNCTION update_raffles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS update_raffles_updated_at_trigger ON raffles;
CREATE TRIGGER update_raffles_updated_at_trigger
    BEFORE UPDATE ON raffles
    FOR EACH ROW
    EXECUTE FUNCTION update_raffles_updated_at();
