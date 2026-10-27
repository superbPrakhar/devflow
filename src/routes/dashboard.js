const express = require('express');
const router = express.Router();
const { getDatabase, seedDemoData } = require('../config/database');

/**
 * GET /api/dashboard/stats
 * Aggregated workspace metrics and status summaries
 */
router.get('/stats', (req, res, next) => {
  try {
    const db = getDatabase();

    // Project metrics
    const projectStats = db.prepare(`
      SELECT 
        COUNT(*) as total_projects,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived_projects
      FROM projects
    `).get();

    // Task metrics
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'backlog' THEN 1 ELSE 0 END) as backlog,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN priority = 'urgent' AND status != 'done' THEN 1 ELSE 0 END) as urgent_open,
        SUM(CASE WHEN priority = 'high' AND status != 'done' THEN 1 ELSE 0 END) as high_open,
        SUM(CASE WHEN priority = 'medium' AND status != 'done' THEN 1 ELSE 0 END) as medium_open,
        SUM(CASE WHEN priority = 'low' AND status != 'done' THEN 1 ELSE 0 END) as low_open,
        SUM(CASE WHEN status != 'done' AND due_date IS NOT NULL AND due_date < date('now') THEN 1 ELSE 0 END) as overdue
      FROM tasks
    `).get();

    // Upcoming deadlines (next 7 days, open tasks)
    const upcomingDeadlines = db.prepare(`
      SELECT 
        t.id, t.task_key, t.title, t.priority, t.status, t.due_date, t.assignee,
        p.name as project_name, p.color as project_color,
        CAST((julianday(t.due_date) - julianday('now')) AS INTEGER) as days_remaining
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.status != 'done' 
        AND t.due_date IS NOT NULL 
        AND t.due_date >= date('now')
        AND t.due_date <= date('now', '+14 days')
      ORDER BY t.due_date ASC
      LIMIT 6
    `).all();

    // Critical overdue tasks
    const overdueTasks = db.prepare(`
      SELECT 
        t.id, t.task_key, t.title, t.priority, t.status, t.due_date, t.assignee,
        p.name as project_name, p.color as project_color,
        CAST((julianday('now') - julianday(t.due_date)) AS INTEGER) as days_overdue
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.status != 'done' 
        AND t.due_date IS NOT NULL 
        AND t.due_date < date('now')
      ORDER BY t.due_date ASC
      LIMIT 6
    `).all();

    // Recent activity stream
    const recentActivity = db.prepare(`
      SELECT a.*, p.name as project_name, p.color as project_color
      FROM activity_logs a
      LEFT JOIN projects p ON a.project_id = p.id
      ORDER BY a.created_at DESC
      LIMIT 12
    `).all();

    const totalTasks = taskStats.total_tasks || 0;
    const doneTasks = taskStats.done || 0;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        projects: {
          total: projectStats.total_projects || 0,
          active: projectStats.active_projects || 0,
          completed: projectStats.completed_projects || 0,
          archived: projectStats.archived_projects || 0
        },
        tasks: {
          total: totalTasks,
          backlog: taskStats.backlog || 0,
          todo: taskStats.todo || 0,
          in_progress: taskStats.in_progress || 0,
          review: taskStats.review || 0,
          done: doneTasks,
          overdue: taskStats.overdue || 0,
          completion_rate: completionRate
        },
        priority_breakdown: {
          urgent: taskStats.urgent_open || 0,
          high: taskStats.high_open || 0,
          medium: taskStats.medium_open || 0,
          low: taskStats.low_open || 0
        },
        upcoming_deadlines: upcomingDeadlines,
        overdue_tasks: overdueTasks,
        recent_activity: recentActivity
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dashboard/seed
 * Seed or reset workspace with high-quality demo data
 */
router.post('/seed', (req, res, next) => {
  try {
    const force = req.query.force === 'true' || req.body.force === true;
    const result = seedDemoData(force);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
