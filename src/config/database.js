const path = require('path');
const fs = require('fs');

let dbInstance = null;

function getDatabase(dbPath = null) {
  if (dbInstance) return dbInstance;

  const resolvedPath = dbPath || process.env.DB_STORAGE || path.join(__dirname, '..', '..', 'devflow.db');
  
  // Ensure directory exists if path contains directories
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Attempt to use better-sqlite3 first, fallback to node:sqlite
  try {
    const Database = require('better-sqlite3');
    const db = new Database(resolvedPath);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    dbInstance = {
      raw: db,
      type: 'better-sqlite3',
      prepare: (sql) => db.prepare(sql),
      exec: (sql) => db.exec(sql),
      close: () => {
        db.close();
        dbInstance = null;
      }
    };
  } catch (err) {
    // Fallback to node:sqlite in Node 22+
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(resolvedPath);
      db.exec('PRAGMA foreign_keys = ON;');

      dbInstance = {
        raw: db,
        type: 'node:sqlite',
        prepare: (sql) => {
          const stmt = db.prepare(sql);
          return {
            all: (...params) => stmt.all(...params),
            get: (...params) => stmt.get(...params),
            run: (...params) => {
              const res = stmt.run(...params);
              return {
                lastInsertRowid: Number(res.lastInsertRowid || 0),
                changes: Number(res.changes || 0)
              };
            }
          };
        },
        exec: (sql) => db.exec(sql),
        close: () => {
          db.close();
          dbInstance = null;
        }
      };
    } catch (innerErr) {
      console.error('Failed to initialize SQLite driver:', innerErr);
      throw new Error('SQLite driver not available: ' + innerErr.message);
    }
  }

  return dbInstance;
}

function initDatabase(customDb = null) {
  const db = customDb || getDatabase();

  // Create Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
      deadline TEXT,
      color TEXT DEFAULT '#4f46e5',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_key TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      assignee TEXT,
      due_date TEXT,
      tags TEXT,
      estimated_hours REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Activity Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      task_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
  `);

  return db;
}

function logActivity(db, { projectId = null, taskId = null, action, details = '' }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO activity_logs (project_id, task_id, action, details)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(projectId, taskId, action, details);
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

function seedDemoData(force = false, customDb = null) {
  const db = customDb || getDatabase();
  initDatabase(db);

  const existing = db.prepare('SELECT COUNT(*) as count FROM projects').get();
  if (existing && existing.count > 0 && !force) {
    return { seeded: false, message: 'Database already contains data' };
  }

  if (force) {
    db.exec('DELETE FROM activity_logs');
    db.exec('DELETE FROM tasks');
    db.exec('DELETE FROM projects');
  }

  // Format today's date and offset dates
  const today = new Date();
  const formatDate = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  // 1. Projects
  const insertProject = db.prepare(`
    INSERT INTO projects (name, key, description, status, deadline, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const p1 = insertProject.run(
    'Cloud Migration Platform',
    'CMP',
    'Migrate microservices architecture from on-premise clusters to AWS ECS and RDS with zero downtime.',
    'active',
    formatDate(30),
    '#3b82f6'
  );

  const p2 = insertProject.run(
    'DevFlow Core Engine',
    'DEV',
    'Core issue tracking, kanban workflow automation, and real-time dashboard analytics system.',
    'active',
    formatDate(14),
    '#6366f1'
  );

  const p3 = insertProject.run(
    'Mobile Experience App',
    'MOB',
    'Next-generation cross-platform mobile client for developers with offline issue synchronization.',
    'active',
    formatDate(45),
    '#ec4899'
  );

  // 2. Tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (task_key, project_id, title, description, status, priority, assignee, due_date, tags, estimated_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demoTasks = [
    // CMP Tasks
    { key: 'CMP-1', pid: p1.lastInsertRowid, title: 'Define Terraform state storage in S3 with DynamoDB locking', desc: 'Configure remote backend with AES256 encryption and state locking prevention.', status: 'done', prio: 'high', assignee: 'Prakhar', due: formatDate(-5), tags: 'devops,terraform,security', hours: 8 },
    { key: 'CMP-2', pid: p1.lastInsertRowid, title: 'Set up Prometheus & Grafana telemetry dashboards', desc: 'Monitor ECS cluster CPU, memory reservations, and network I/O spikes.', status: 'in_progress', prio: 'medium', assignee: 'Alex Chen', due: formatDate(4), tags: 'monitoring,devops', hours: 12 },
    { key: 'CMP-3', pid: p1.lastInsertRowid, title: 'Implement automated database cutover scripts', desc: 'Create idempotent replication verification script for MySQL RDS migration.', status: 'todo', prio: 'urgent', assignee: 'Prakhar', due: formatDate(-1), tags: 'database,migration', hours: 16 },
    { key: 'CMP-4', pid: p1.lastInsertRowid, title: 'Review IAM least-privilege role policies', desc: 'Audit AWS roles and eliminate wildcard permission blocks.', status: 'backlog', prio: 'low', assignee: 'Sarah Kim', due: formatDate(18), tags: 'security,compliance', hours: 6 },

    // DEV Tasks
    { key: 'DEV-1', pid: p2.lastInsertRowid, title: 'Design RESTful API for projects and task management', desc: 'Full CRUD with pagination, filtering, input validation, and proper HTTP error codes.', status: 'done', prio: 'urgent', assignee: 'Prakhar', due: formatDate(-3), tags: 'api,backend,express', hours: 14 },
    { key: 'DEV-2', pid: p2.lastInsertRowid, title: 'Build responsive Kanban board with drag-and-drop', desc: 'Intuitive multi-column drag-and-drop interface with instant status persistence.', status: 'in_progress', prio: 'high', assignee: 'Elena Rostova', due: formatDate(2), tags: 'frontend,ui,kanban', hours: 18 },
    { key: 'DEV-3', pid: p2.lastInsertRowid, title: 'Implement full-text search and multi-criteria filters', desc: 'Fast client/server query filtering by priority, assignee, status, and keywords.', status: 'review', prio: 'high', assignee: 'Prakhar', due: formatDate(1), tags: 'search,performance', hours: 10 },
    { key: 'DEV-4', pid: p2.lastInsertRowid, title: 'Implement native dialog modals for task editing', desc: 'Accessible HTML5 dialogs with light-dismiss and keyboard navigation.', status: 'in_progress', prio: 'medium', assignee: 'David Miller', due: formatDate(3), tags: 'accessibility,ui', hours: 8 },
    { key: 'DEV-5', pid: p2.lastInsertRowid, title: 'Add SQLite/MySQL relational database abstraction', desc: 'Unified database driver supporting zero-config SQLite and production MySQL.', status: 'done', prio: 'medium', assignee: 'Prakhar', due: formatDate(-4), tags: 'database,sqlite,sql', hours: 10 },
    { key: 'DEV-6', pid: p2.lastInsertRowid, title: 'Automated end-to-end REST API integration tests', desc: 'Test coverage for all HTTP endpoints, pagination boundaries, and cascade operations.', status: 'todo', prio: 'medium', assignee: 'Elena Rostova', due: formatDate(5), tags: 'testing,qa', hours: 12 },

    // MOB Tasks
    { key: 'MOB-1', pid: p3.lastInsertRowid, title: 'Design user onboarding flow and biometric login UI', desc: 'Craft Figma component library for FaceID / TouchID authentication prompts.', status: 'done', prio: 'low', assignee: 'Sarah Kim', due: formatDate(-2), tags: 'design,auth,mobile', hours: 15 },
    { key: 'MOB-2', pid: p3.lastInsertRowid, title: 'Build offline local SQLite cache sync engine', desc: 'Synchronize pending offline mutations when cellular connection restores.', status: 'in_progress', prio: 'urgent', assignee: 'Prakhar', due: formatDate(7), tags: 'sync,offline,mobile', hours: 24 },
    { key: 'MOB-3', pid: p3.lastInsertRowid, title: 'Push notification service for overdue task alerts', desc: 'Send daily morning digest for tasks nearing deadline or flagged as urgent.', status: 'backlog', prio: 'medium', assignee: 'Alex Chen', due: formatDate(14), tags: 'notifications,fcm', hours: 8 }
  ];

  for (const t of demoTasks) {
    const res = insertTask.run(t.key, t.pid, t.title, t.desc, t.status, t.prio, t.assignee, t.due, t.tags, t.hours);
    logActivity(db, {
      projectId: t.pid,
      taskId: res.lastInsertRowid,
      action: 'TASK_CREATED',
      details: `Created task ${t.key}: ${t.title}`
    });
  }

  logActivity(db, {
    action: 'SYSTEM_SEEDED',
    details: 'Initial workspace seeded with 3 projects and 13 demo tasks'
  });

  return { seeded: true, message: 'Database initialized and seeded with demo projects and tasks' };
}

module.exports = {
  getDatabase,
  initDatabase,
  logActivity,
  seedDemoData
};
