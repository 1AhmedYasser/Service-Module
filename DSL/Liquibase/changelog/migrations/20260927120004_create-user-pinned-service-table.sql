CREATE TABLE IF NOT EXISTS user_pinned_service (
  id BIGSERIAL PRIMARY KEY,
  user_id_code TEXT NOT NULL,
  service_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_pinned_service_unique UNIQUE (user_id_code, service_id)
);
