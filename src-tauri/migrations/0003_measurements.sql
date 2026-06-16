CREATE TABLE measurements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  points_json TEXT NOT NULL,
  total_distance_meters REAL NOT NULL CHECK (total_distance_meters > 0),
  coordinate_system TEXT NOT NULL DEFAULT 'BD09' CHECK (coordinate_system = 'BD09'),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_measurements_project_active
  ON measurements(project_id, updated_at)
  WHERE deleted_at IS NULL;
