-- Expand token columns to avoid overflow with JWT strings
BEGIN;
ALTER TABLE user_sessions 
  ALTER COLUMN session_token TYPE TEXT,
  ALTER COLUMN refresh_token TYPE TEXT;
COMMIT;
