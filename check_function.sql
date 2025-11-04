-- Verificar la función actual en Railway
SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'generate_unique_bingo_room_code';
