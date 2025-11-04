-- EJECUTAR EN RAILWAY - Asignar rol admin a prueba1
INSERT INTO user_roles (user_id, role_id, granted_by)
VALUES (
    '208d5eab-d6ce-4b56-9f18-f34bfdb29381',  -- UUID de prueba1
    (SELECT id FROM roles WHERE name = 'admin'),
    '208d5eab-d6ce-4b56-9f18-f34bfdb29381'   -- Auto-asignado
)
ON CONFLICT (user_id, role_id) DO NOTHING;
