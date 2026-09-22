-- 浏览者表情计数。count 只在有对应 vote 时增减。
CREATE TABLE IF NOT EXISTS reactions (
  emoji TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);

CREATE TABLE IF NOT EXISTS votes (
  visitor TEXT NOT NULL,
  emoji TEXT NOT NULL,
  PRIMARY KEY (visitor, emoji)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL
);

INSERT INTO reactions (emoji, count) VALUES
  ('👍', 0),
  ('❤️', 0),
  ('🔥', 0),
  ('🎉', 0)
ON CONFLICT(emoji) DO NOTHING;
