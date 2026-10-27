const express = require('express');
const router = express.Router();
const { getDatabase, logActivity } = require('../config/database');
const { validateTask } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Generate next task key for a project (e.g. "DEV-5")
 */
function getNextTaskKey(projectId, projectKey, db) {
  // Find highest index for this project
  const rows = db.prepare(`
    SELECT task_key FROM tasks WHERE project_id = ?
  `).all(projectId);

  let maxNum = 0;
  for (const r of rows) {
    const parts = r.task_key.split('-');
    if (parts.length === 2) {
      const n = parseInt(parts[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }

  return `${projectKey}-${maxNum + 1}`;
}

/**
 * Priority order mapper for SQL sorting
 */
const PRIORITY_ORDER_SQL = `
  CASE t.priority 
    WHEN 'urgent' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    WHEN 'low' THEN 4 
    ELSE 5 
  END
`;

/**
 * GET /api/tasks
 * Retrieve tasks with multi-field filtering, search, sorting, and pagination
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const {
      project_id,
      status,
      priority,
      assignee,
      overdue,
      q,
      search,
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const searchTerm = q || search;
    const whereClauses = [];
    const params = [];

    if (project_id) {
      whereClauses.push('t.project_id = ?');
      params.push(parseInt(project_id, 10));
    }

    if (status) {
      whereClauses.push('t.status = ?');
      params.push(status);
    }

    if (priority) {
      whereClauses.push('t.priority = ?');
      params.push(priority);
    }

    if (assignee) {
      whereClauses.push('t.assignee LIKE ?');
      params.push(`%${assignee}%`);
    }

    if (overdue === 'true' || overdue === '1') {
      whereClauses.push("t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now')");
    }

    if (searchTerm) {
      whereClauses.push('(t.title LIKE ? OR t.description LIKE ? OR t.task_key LIKE ? OR t.tags LIKE ?)');
      const term = `%${searchTerm}%`;
      params.push(term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Dynamic sorting
    let orderBySql = 't.created_at DESC';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    if (sort === 'priority') {
      orderBySql = `${PRIORITY_ORDER_SQL} ${sortOrder}, t.due_date ASC`;
    } else if (sort === 'due_date') {
      // Put tasks with no due date last
      orderBySql = `CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ${sortOrder}`;
    } else if (['title', 'status', 'created_at', 'task_key'].includes(sort)) {
      orderBySql = `t.${sort} ${sortOrder}`;
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM tasks t ${whereSql}`;
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;

    // Fetch tasks with project metadata
    const querySql = `
      SELECT 
        t.*,
        p.name as project_name,
        p.key as project_key,
        p.color as project_color,
        CASE 
          WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now') THEN 1 
          ELSE 0 
        END as is_overdue
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ? OFFSET ?
    `;

    const tasks = db.prepare(querySql).all(...params, limit, offset);

    res.json({
      success: true,
      data: tasks,
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
 * GET /api/tasks/:id
 * Retrieve single task details
 */
router.get('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const task = db.prepare(`
      SELECT 
        t.*,
        p.name as project_name,
        p.key as project_key,
        p.color as project_color,
        CASE 
          WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now') THEN 1 
          ELSE 0 
        END as is_overdue
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? OR t.task_key = ?
    `).get(id, id);

    if (!task) {
      throw ApiError.notFound(`Task with id or key '${id}' not found`);
    }

    // Recent activity for this task
    const activity = db.prepare(`
      SELECT * FROM activity_logs 
      WHERE task_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(task.id);

    res.json({
      success: true,
      data: {
        ...task,
        recent_activity: activity
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tasks
 * Create a new task with auto-generated key
 */
router.post('/', validateTask, (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      project_id,
      title,
      description = '',
      status = 'todo',
      priority = 'medium',
      assignee = '',
      due_date = null,
      tags = '',
      estimated_hours = 0
    } = req.body;

    const project = db.prepare('SELECT id, name, key FROM projects WHERE id = ?').get(project_id);
    if (!project) {
      throw ApiError.badRequest(`Project with id ${project_id} does not exist`);
    }

    const taskKey = getNextTaskKey(project.id, project.key, db);

    const stmt = db.prepare(`
      INSERT INTO tasks (
        task_key, project_id, title, description, status, priority, assignee, due_date, tags, estimated_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      taskKey,
      project.id,
      title.trim(),
      description.trim(),
      status,
      priority,
      assignee.trim(),
      due_date || null,
      tags.trim(),
      Number(estimated_hours) || 0
    );

    const newTask = db.prepare(`
      SELECT t.*, p.name as project_name, p.key as project_key, p.color as project_color
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    logActivity(db, {
      projectId: project.id,
      taskId: newTask.id,
      action: 'TASK_CREATED',
      details: `Created task ${newTask.task_key}: '${newTask.title}' (${newTask.priority} priority, ${newTask.status})`
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTask
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/tasks/:id
 * Full update for a task
 */
router.put('/:id', validateTask, (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const {
      project_id,
      title,
      description = '',
      status = 'todo',
      priority = 'medium',
      assignee = '',
      due_date = null,
      tags = '',
      estimated_hours = 0
    } = req.body;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      throw ApiError.notFound(`Task with id ${id} not found`);
    }

    let targetProjectId = existing.project_id;
    if (project_id && project_id !== existing.project_id) {
      const proj = db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id);
      if (!proj) {
        throw ApiError.badRequest(`Project with id ${project_id} does not exist`);
      }
      targetProjectId = project_id;
    }

    const stmt = db.prepare(`
      UPDATE tasks 
      SET project_id = ?, title = ?, description = ?, status = ?, priority = ?,
          assignee = ?, due_date = ?, tags = ?, estimated_hours = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      targetProjectId,
      title.trim(),
      description.trim(),
      status,
      priority,
      assignee.trim(),
      due_date || null,
      tags.trim(),
      Number(estimated_hours) || 0,
      id
    );

    const updated = db.prepare(`
      SELECT t.*, p.name as project_name, p.key as project_key, p.color as project_color
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(id);

    logActivity(db, {
      projectId: updated.project_id,
      taskId: id,
      action: 'TASK_UPDATED',
      details: `Updated task ${updated.task_key}: '${updated.title}'`
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/tasks/:id
 * Partial update for a task (ideal for Kanban drag-and-drop & inline priority changes)
 */
router.patch('/:id', validateTask, (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      throw ApiError.notFound(`Task with id ${id} not found`);
    }

    const allowedFields = ['title', 'description', 'status', 'priority', 'assignee', 'due_date', 'tags', 'estimated_hours', 'project_id'];
    const updates = [];
    const params = [];
    const changeLogs = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        let val = req.body[field];
        if (typeof val === 'string') val = val.trim();
        if (field === 'due_date' && val === '') val = null;
        if (field === 'estimated_hours') val = Number(val) || 0;
        params.push(val);

        if (existing[field] !== val) {
          changeLogs.push(`${field} changed from '${existing[field]}' to '${val}'`);
        }
      }
    }

    if (updates.length === 0) {
      return res.json({
        success: true,
        message: 'No fields were modified',
        data: existing
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);

    const updated = db.prepare(`
      SELECT t.*, p.name as project_name, p.key as project_key, p.color as project_color
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(id);

    logActivity(db, {
      projectId: updated.project_id,
      taskId: id,
      action: 'TASK_PATCHED',
      details: `${updated.task_key}: ${changeLogs.join(', ')}`
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      throw ApiError.notFound(`Task with id ${id} not found`);
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    logActivity(db, {
      projectId: existing.project_id,
      taskId: id,
      action: 'TASK_DELETED',
      details: `Deleted task ${existing.task_key}: '${existing.title}'`
    });

    res.json({
      success: true,
      message: `Task '${existing.task_key}' deleted successfully`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
