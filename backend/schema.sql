-- SQLite Schema for TORCH Database
-- One single file defining the entire SQLite database layout.

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    command TEXT,
    status TEXT,
    steps_json TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS steps (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    tool TEXT,
    label TEXT,
    status TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    command TEXT,
    count INTEGER DEFAULT 1,
    last_used TEXT DEFAULT (datetime('now')),
    hour_of_day INTEGER,
    day_of_week TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    platform TEXT,
    interaction_count INTEGER DEFAULT 0,
    last_interaction TEXT
);

CREATE TABLE IF NOT EXISTS files_accessed (
    id TEXT PRIMARY KEY,
    filepath TEXT,
    action TEXT,
    access_count INTEGER DEFAULT 0,
    last_accessed TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    message TEXT,
    dismissed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    command TEXT,
    cron_expression TEXT,
    last_run TEXT,
    next_run TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT,
    command TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    run_count INTEGER DEFAULT 0
);

-- Legacy table for backward compatibility
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    app TEXT,
    description TEXT,
    screenshot_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);