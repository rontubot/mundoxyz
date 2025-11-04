-- Asignar rol admin a usuario prueba1 para testing
-- Este script debe ejecutarse en Railway PostgreSQL

-- Verificar roles disponibles
SELECT * FROM roles;

-- Verificar usuario prueba1
SELECT id, username, email FROM users WHERE username = 'prueba1';

-- Asignar rol admin (id = 2) a prueba1
-- IMPORTANTE: Reemplazar USER_ID con el UUID real de prueba1
INSERT INTO user_roles (user_id, role_id, granted_by)
VALUES (
    (SELECT id FROM users WHERE username = 'prueba1'),
    (SELECT id FROM roles WHERE name = 'admin'),
    (SELECT id FROM users WHERE username = 'prueba1')  -- Se auto-asigna para testing
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Verificar que se asignó correctamente
SELECT 
    u.username,
    r.name as role_name,
    ur.granted_at
FROM user_roles ur
JOIN users u ON ur.user_id = u.id
JOIN roles r ON ur.role_id = r.id
WHERE u.username = 'prueba1';
