const express = require('express');
const router = express.Router();
const { getDatabase, logActivity } = require('../config/database');
const { validateProject } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Generate a project key from its name (e.g. "DevFlow Engine" -> "DEV")
 */
function generateProjectKey(name, db) {
  const words = name.trim().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  let baseKey = '';
  if (words.length === 1) {
    baseKey = words[0].substring(0, 4).toUpperCase();
  } else {
    baseKey = words.slice(0, 4).map(w => w[0]).join('').toUpperCase();
  }
  if (baseKey.length < 2) baseKey = 'PRJ';

  // Check collision
  let candidate = baseKey;
  let counter = 1;
  while (true) {
    const existing = db.prepare('SELECT id FROM projects WHERE key = ?').get(candidate);
    if (!existing) return candidate;
    counter++;
    candidate = `${baseKey}${counter}`;
  }
}

/**
 * GET /api/projects
 * List all projects with status counts, completion %, and pagination
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { status, search, sort = 'created_at', order = 'desc' } = req.query;

    const whereClauses = [];
    const params = [];

    if (status) {
      whereClauses.push('p.status = ?');
      params.push(status);
    }

    if (search) {
      whereClauses.push('(p.name LIKE ? OR p.key LIKE ? OR p.description LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    // Whitelist sort fields
    const validSortFields = ['created_at', 'name', 'deadline', 'status'];
    const sortField = validSortFields.includes(sort) ? `p.${sort}` : 'p.created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Total count for pagination
    const countSql = `SELECT COUNT(*) as total FROM projects p ${whereSql}`;
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;

    // Fetch projects with aggregated task metrics
    const querySql = `
      SELECT 
        p.*,
        COUNT(t.id) as total_tasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_tasks,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN t.status = 'review' THEN 1 ELSE 0 END) as review_tasks,
        SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
        SUM(CASE WHEN t.status = 'backlog' THEN 1 ELSE 0 END) as backlog_tasks,
        SUM(CASE WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now') THEN 1 ELSE 0 END) as overdue_tasks
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      ${whereSql}
      GROUP BY p.id
      ORDER BY ${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const projects = db.prepare(querySql).all(...params, limit, offset);

    // Compute progress % for each project
    const formatted = projects.map(p => {
      const totalTasks = p.total_tasks || 0;
      const doneTasks = p.done_tasks || 0;
      const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
      return {
        ...p,
        total_tasks: totalTasks,
        done_tasks: doneTasks,
        in_progress_tasks: p.in_progress_tasks || 0,
        review_tasks: p.review_tasks || 0,
        todo_tasks: p.todo_tasks || 0,
        backlog_tasks: p.backlog_tasks || 0,
        overdue_tasks: p.overdue_tasks || 0,
        progress_percentage: progress
      };
    });

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/projects/:id
 * Retrieve single project details with breakdown
 */
router.get('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const project = db.prepare(`
      SELECT 
        p.*,
        COUNT(t.id) as total_tasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_tasks,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN t.status = 'review' THEN 1 ELSE 0 END) as review_tasks,
        SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
        SUM(CASE WHEN t.status = 'backlog' THEN 1 ELSE 0 END) as backlog_tasks,
        SUM(CASE WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now') THEN 1 ELSE 0 END) as overdue_tasks
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(id);

    if (!project) {
      throw ApiError.notFound(`Project with id ${id} not found`);
    }

    const totalTasks = project.total_tasks || 0;
    const doneTasks = project.done_tasks || 0;
    project.progress_percentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Fetch recent activity
    const activity = db.prepare(`
      SELECT * FROM activity_logs 
      WHERE project_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(id);

    res.json({
      success: true,
      data: {
        ...project,
        recent_activity: activity
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', validateProject, (req, res, next) => {
  try {
    const db = getDatabase();
    const { name, description = '', status = 'active', deadline = null, color = '#4f46e5' } = req.body;
    let { key } = req.body;

    if (!key || !key.trim()) {
      key = generateProjectKey(name, db);
    } else {
      key = key.trim().toUpperCase();
      const existing = db.prepare('SELECT id FROM projects WHERE key = ?').get(key);
      if (existing) {
        throw ApiError.conflict(`Project with key '${key}' already exists`);
      }
    }

    const stmt = db.prepare(`
      INSERT INTO projects (name, key, description, status, deadline, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name.trim(), key, description.trim(), status, deadline || null, color);
    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);

    logActivity(db, {
      projectId: newProject.id,
      action: 'PROJECT_CREATED',
      details: `Project '${newProject.name}' (${newProject.key}) created`
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: newProject
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/projects/:id
 * Update an existing project
 */
router.put('/:id', validateProject, (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, description = '', status = 'active', deadline = null, color = '#4f46e5' } = req.body;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      throw ApiError.notFound(`Project with id ${id} not found`);
    }

    const stmt = db.prepare(`
      UPDATE projects 
      SET name = ?, description = ?, status = ?, deadline = ?, color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(name.trim(), description.trim(), status, deadline || null, color, id);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    logActivity(db, {
      projectId: id,
      action: 'PROJECT_UPDATED',
      details: `Project '${updated.name}' details updated`
    });

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project (cascades tasks)
 */
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      throw ApiError.notFound(`Project with id ${id} not found`);
    }

    // SQLite cascade foreign keys will delete associated tasks
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    logActivity(db, {
      action: 'PROJECT_DELETED',
      details: `Project '${existing.name}' (${existing.key}) and its tasks were deleted`
    });

    res.json({
      success: true,
      message: `Project '${existing.name}' and all associated tasks deleted successfully`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
