require('dotenv').config();
const { createApp } = require('./src/app');
const { getDatabase, initDatabase, seedDemoData } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

// Initialize Database schema and seed default data if empty
try {
  const db = getDatabase();
  initDatabase(db);
  seedDemoData(false, db);
  console.log('✓ DevFlow database initialized and ready.');
} catch (err) {
  console.error('Database initialization error:', err);
}

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`
======================================================
  ⚡ DevFlow – Issue & Task Tracker is running!
  ✓ URL:      http://localhost:${PORT}
  ✓ REST API: http://localhost:${PORT}/api/docs/spec
  ✓ Mode:     ${process.env.NODE_ENV || 'development'}
======================================================
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down DevFlow server...');
  server.close(() => {
    try {
      const db = getDatabase();
      db.close();
    } catch (_) {}
    console.log('DevFlow server stopped.');
    process.exit(0);
  });
});

module.exports = server;
