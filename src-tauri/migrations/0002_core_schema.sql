CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE project_settings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  search_city TEXT NOT NULL DEFAULT '上海',
  map_layer TEXT NOT NULL DEFAULT 'normal' CHECK (map_layer IN ('normal', 'satellite')),
  map_center_lng REAL,
  map_center_lat REAL,
  map_zoom REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_project_settings_project_active
  ON project_settings(project_id)
  WHERE deleted_at IS NULL;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_categories_project_name_active
  ON categories(project_id, name)
  WHERE deleted_at IS NULL;

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_tags_project_name_active
  ON tags(project_id, name)
  WHERE deleted_at IS NULL;

CREATE TABLE markers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  coordinate_system TEXT NOT NULL DEFAULT 'BD09' CHECK (coordinate_system = 'BD09'),
  address TEXT,
  category_id TEXT,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'search', 'center')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_markers_project_active
  ON markers(project_id, updated_at)
  WHERE deleted_at IS NULL;

CREATE TABLE marker_tags (
  marker_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (marker_id, tag_id),
  FOREIGN KEY (marker_id) REFERENCES markers(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE app_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX idx_app_settings_key_active
  ON app_settings(key)
  WHERE deleted_at IS NULL;

CREATE TABLE backup_metadata (
  id TEXT PRIMARY KEY,
  backup_path TEXT NOT NULL,
  backup_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
