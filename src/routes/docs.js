const express = require('express');
const router = express.Router();

const API_DOCUMENTATION = {
  title: 'DevFlow REST API Specification',
  version: '1.0.0',
  description: 'Complete documentation for the DevFlow issue and task tracking REST API.',
  baseUrl: '/api',
  endpoints: [
    {
      group: 'Dashboard & Analytics',
      routes: [
        {
          method: 'GET',
          path: '/api/dashboard/stats',
          description: 'Retrieve aggregated workspace metrics, status breakdown, upcoming deadlines, and recent activity.',
          parameters: [],
          response: {
            success: true,
            data: {
              projects: { total: 3, active: 3, completed: 0, archived: 0 },
              tasks: { total: 13, backlog: 2, todo: 3, in_progress: 4, review: 1, done: 3, overdue: 3, completion_rate: 23 },
              priority_breakdown: { urgent: 3, high: 3, medium: 3, low: 1 }
            }
          }
        },
        {
          method: 'POST',
          path: '/api/dashboard/seed',
          description: 'Populate or reset database with realistic sample projects and tasks.',
          parameters: [{ name: 'force', type: 'query/body boolean', description: 'Force reset existing data' }],
          response: { success: true, seeded: true, message: 'Database initialized and seeded' }
        }
      ]
    },
    {
      group: 'Projects',
      routes: [
        {
          method: 'GET',
          path: '/api/projects',
          description: 'List all workspace projects with task completion counts and pagination.',
          parameters: [
            { name: 'search', type: 'query string', description: 'Filter by name, key, or description' },
            { name: 'status', type: 'query string', description: 'Filter by status: active, completed, archived' },
            { name: 'page', type: 'query integer', description: 'Page number (default: 1)' },
            { name: 'limit', type: 'query integer', description: 'Items per page (default: 20, max: 100)' },
            { name: 'sort', type: 'query string', description: 'Sort field: created_at, name, deadline, status' },
            { name: 'order', type: 'query string', description: 'Sort direction: asc or desc' }
          ],
          response: {
            success: true,
            data: [{ id: 1, name: 'Cloud Platform', key: 'CMP', total_tasks: 4, done_tasks: 1, progress_percentage: 25 }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
          }
        },
        {
          method: 'POST',
          path: '/api/projects',
          description: 'Create a new project workspace.',
          parameters: [
            { name: 'name', type: 'body string (required)', description: 'Project name (min 2 characters)' },
            { name: 'key', type: 'body string (optional)', description: '2-10 uppercase alphanumeric key (auto-generated if omitted)' },
            { name: 'description', type: 'body string (optional)', description: 'Project overview' },
            { name: 'status', type: 'body string (optional)', description: 'active | completed | archived (default: active)' },
            { name: 'deadline', type: 'body date (optional)', description: 'Target completion date (YYYY-MM-DD)' },
            { name: 'color', type: 'body hex (optional)', description: 'Brand color hex (default: #4f46e5)' }
          ],
          response: {
            success: true,
            message: 'Project created successfully',
            data: { id: 4, name: 'AI Assistant', key: 'AI', status: 'active' }
          }
        },
        {
          method: 'GET',
          path: '/api/projects/:id',
          description: 'Retrieve detailed project info, task status distribution, and activity logs.',
          parameters: [{ name: 'id', type: 'path integer', description: 'Project ID' }],
          response: { success: true, data: { id: 1, name: 'Cloud Platform', recent_activity: [] } }
        },
        {
          method: 'PUT',
          path: '/api/projects/:id',
          description: 'Update project properties.',
          parameters: [
            { name: 'id', type: 'path integer', description: 'Project ID' },
            { name: 'name', type: 'body string', description: 'Updated name' },
            { name: 'description', type: 'body string', description: 'Updated description' },
            { name: 'status', type: 'body string', description: 'active | completed | archived' },
            { name: 'deadline', type: 'body date', description: 'Target date' }
          ],
          response: { success: true, message: 'Project updated successfully' }
        },
        {
          method: 'DELETE',
          path: '/api/projects/:id',
          description: 'Delete project and cascade delete all associated tasks.',
          parameters: [{ name: 'id', type: 'path integer', description: 'Project ID' }],
          response: { success: true, message: 'Project deleted successfully' }
        }
      ]
    },
    {
      group: 'Tasks & Issues',
      routes: [
        {
          method: 'GET',
          path: '/api/tasks',
          description: 'List issues and tasks with filtering, full-text search, and pagination.',
          parameters: [
            { name: 'project_id', type: 'query integer', description: 'Filter tasks by project' },
            { name: 'status', type: 'query string', description: 'backlog | todo | in_progress | review | done' },
            { name: 'priority', type: 'query string', description: 'low | medium | high | urgent' },
            { name: 'assignee', type: 'query string', description: 'Filter by assignee name' },
            { name: 'overdue', type: 'query boolean', description: 'Filter to only overdue open tasks' },
            { name: 'q / search', type: 'query string', description: 'Search term across title, description, tags, and key' },
            { name: 'sort', type: 'query string', description: 'priority | due_date | created_at | title | status' },
            { name: 'order', type: 'query string', description: 'asc | desc' },
            { name: 'page', type: 'query integer', description: 'Page number (default: 1)' },
            { name: 'limit', type: 'query integer', description: 'Page size (default: 20)' }
          ],
          response: {
            success: true,
            data: [{ id: 1, task_key: 'DEV-1', title: 'Design REST API', status: 'done', priority: 'urgent' }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
          }
        },
        {
          method: 'POST',
          path: '/api/tasks',
          description: 'Create a new issue with auto-generated project key prefix (e.g. DEV-5).',
          parameters: [
            { name: 'project_id', type: 'body integer (required)', description: 'ID of target project' },
            { name: 'title', type: 'body string (required)', description: 'Task title (min 3 characters)' },
            { name: 'description', type: 'body string (optional)', description: 'Detailed issue description' },
            { name: 'status', type: 'body string (optional)', description: 'backlog | todo | in_progress | review | done (default: todo)' },
            { name: 'priority', type: 'body string (optional)', description: 'low | medium | high | urgent (default: medium)' },
            { name: 'assignee', type: 'body string (optional)', description: 'Assigned developer name' },
            { name: 'due_date', type: 'body date (optional)', description: 'Deadline (YYYY-MM-DD)' },
            { name: 'tags', type: 'body string (optional)', description: 'Comma-separated tags (e.g. "api,security")' },
            { name: 'estimated_hours', type: 'body number (optional)', description: 'Estimated effort in hours' }
          ],
          response: {
            success: true,
            message: 'Task created successfully',
            data: { id: 14, task_key: 'DEV-7', title: 'Implement dark mode', status: 'todo' }
          }
        },
        {
          method: 'GET',
          path: '/api/tasks/:id',
          description: 'Retrieve task details by ID or task_key (e.g. DEV-1).',
          parameters: [{ name: 'id', type: 'path string', description: 'Numeric ID or task_key' }],
          response: { success: true, data: { id: 1, task_key: 'DEV-1', title: 'Design REST API' } }
        },
        {
          method: 'PUT',
          path: '/api/tasks/:id',
          description: 'Full update of a task.',
          parameters: [{ name: 'id', type: 'path integer', description: 'Task ID' }],
          response: { success: true, message: 'Task updated successfully' }
        },
        {
          method: 'PATCH',
          path: '/api/tasks/:id',
          description: 'Partial update for quick inline changes (Kanban column drop, priority change, assignee change).',
          parameters: [
            { name: 'id', type: 'path integer', description: 'Task ID' },
            { name: 'status', type: 'body string (optional)', description: 'New status' },
            { name: 'priority', type: 'body string (optional)', description: 'New priority' },
            { name: 'assignee', type: 'body string (optional)', description: 'New assignee' }
          ],
          response: { success: true, message: 'Task updated successfully', data: { id: 1, status: 'in_progress' } }
        },
        {
          method: 'DELETE',
          path: '/api/tasks/:id',
          description: 'Delete a task.',
          parameters: [{ name: 'id', type: 'path integer', description: 'Task ID' }],
          response: { success: true, message: "Task 'DEV-1' deleted successfully" }
        }
      ]
    }
  ]
};

router.get('/spec', (req, res) => {
  res.json(API_DOCUMENTATION);
});

module.exports = router;
