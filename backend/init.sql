-- AI Capsule database schema.
--
-- Single source of truth for the table; db.js executes this file on boot.
-- Every row belongs to exactly one authenticated user. user_id is populated from
-- the verified application JWT - never from the request body.

CREATE TABLE IF NOT EXISTS capsules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  prompt_title TEXT NOT NULL,
  prompt_version TEXT,
  prompt_text TEXT NOT NULL,
  response_summary TEXT,
  category TEXT,
  usefulness TEXT,
  reviewed INTEGER DEFAULT 0,
  improved INTEGER DEFAULT 0,
  screenshot_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Every capsule query is scoped by user_id, so this index carries the read path.
CREATE INDEX IF NOT EXISTS idx_capsules_user_id ON capsules(user_id);
