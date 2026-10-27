const { ApiError } = require('./errorHandler');

const VALID_TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'];
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_PROJECT_STATUSES = ['active', 'completed', 'archived'];

function isValidDateString(dateStr) {
  if (!dateStr) return true;
  // Match YYYY-MM-DD or ISO 8601 string
  const regex = /^\d{4}-\d{2}-\d{2}/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function validateProject(req, res, next) {
  const { name, key, status, deadline } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Project name is required and must be at least 2 characters.');
  }

  if (key !== undefined) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{2,10}$/.test(key.trim())) {
      errors.push('Project key must be 2-10 alphanumeric characters (e.g. "DEV", "API").');
    }
  }

  if (status && !VALID_PROJECT_STATUSES.includes(status)) {
    errors.push(`Invalid status. Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`);
  }

  if (deadline && !isValidDateString(deadline)) {
    errors.push('Deadline must be a valid date in YYYY-MM-DD format.');
  }

  if (errors.length > 0) {
    return next(ApiError.badRequest('Project validation failed', errors));
  }

  next();
}

function validateTask(req, res, next) {
  const { title, project_id, status, priority, due_date, estimated_hours } = req.body;
  const errors = [];

  if (req.method === 'POST') {
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      errors.push('Task title is required and must be at least 3 characters.');
    }
    if (!project_id || isNaN(Number(project_id))) {
      errors.push('Valid project_id is required.');
    }
  } else {
    // PUT / PATCH
    if (title !== undefined && (typeof title !== 'string' || title.trim().length < 3)) {
      errors.push('Task title must be at least 3 characters.');
    }
    if (project_id !== undefined && isNaN(Number(project_id))) {
      errors.push('project_id must be a valid integer.');
    }
  }

  if (status && !VALID_TASK_STATUSES.includes(status)) {
    errors.push(`Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`);
  }

  if (priority && !VALID_TASK_PRIORITIES.includes(priority)) {
    errors.push(`Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`);
  }

  if (due_date && !isValidDateString(due_date)) {
    errors.push('Due date must be a valid date in YYYY-MM-DD format.');
  }

  if (estimated_hours !== undefined && (isNaN(Number(estimated_hours)) || Number(estimated_hours) < 0)) {
    errors.push('Estimated hours must be a non-negative number.');
  }

  if (errors.length > 0) {
    return next(ApiError.badRequest('Task validation failed', errors));
  }

  next();
}

module.exports = {
  VALID_TASK_STATUSES,
  VALID_TASK_PRIORITIES,
  VALID_PROJECT_STATUSES,
  validateProject,
  validateTask
};
