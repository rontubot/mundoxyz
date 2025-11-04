-- Migración: Agregar sistema de recuperación de claves con pregunta de seguridad
-- Fecha: 26 de Octubre 2025
-- Autor: Sistema MUNDOXYZ

-- 1. Agregar columna para respuesta de seguridad
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS security_answer VARCHAR(255);

-- 2. Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_users_security_answer ON users(security_answer);

-- 3. Comentarios de documentación
COMMENT ON COLUMN users.security_answer IS 'Respuesta de seguridad hasheada con bcrypt para recuperación de clave';

-- 4. Nota: Todos los usuarios existentes tendrán security_answer = NULL
-- Esto es OK, podrán agregarla desde su perfil después de login
-- Usuario prueba1 puede usar el endpoint de reset-password para configurar nueva clave
