const express = require('express');
const cors = require('cors');
const path = require('path');
const { requestLogger } = require('./utils/logger');
const { errorHandler, ApiError } = require('./middleware/errorHandler');

const projectsRouter = require('./routes/projects');
const tasksRouter = require('./routes/tasks');
const dashboardRouter = require('./routes/dashboard');
const docsRouter = require('./routes/docs');

function createApp() {
  const app = express();

  // Core Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Serve Static Frontend Assets
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  });

  // REST API Routes
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/docs', docsRouter);

  // Fallback for unmatched API routes
  app.use('/api', (req, res, next) => {
    next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} not found`));
  });

  // Fallback to index.html for SPA frontend routing
  app.use((req, res, next) => {
    if (req.method === 'GET') {
      return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
    next();
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp
};
