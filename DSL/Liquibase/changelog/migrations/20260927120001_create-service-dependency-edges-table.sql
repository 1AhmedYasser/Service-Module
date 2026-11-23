CREATE TABLE IF NOT EXISTS service_dependency_edges (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_name TEXT,
  PRIMARY KEY (source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_service_dependency_edges_target_id ON service_dependency_edges (target_id);
