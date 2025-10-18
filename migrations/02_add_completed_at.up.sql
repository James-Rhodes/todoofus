ALTER TABLE todos
ADD COLUMN completed_at TEXT;

UPDATE todos
SET completed_at = created_at
WHERE completed = 1;
