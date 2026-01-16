import { Database } from "bun:sqlite";

const db = new Database(':memory:');

console.log('Initializing database...');

db.run(`
  CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_telemetry_device_ts
    ON telemetry_events (device_id, ts);
`);

console.log('Database initialized');

export default db;
