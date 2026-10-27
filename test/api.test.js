const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Setup isolated test database
const testDbPath = path.join(__dirname, 'test_devflow.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
process.env.DB_STORAGE = testDbPath;
process.env.NODE_ENV = 'test';

const { getDatabase, initDatabase, seedDemoData } = require('../src/config/database');
const { createApp } = require('../src/app');

let server;
let baseUrl;

// Helper to make JSON HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (_) {
          json = rawData;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('DevFlow REST API Integration Tests', () => {
  before(async () => {
    const db = getDatabase(testDbPath);
    initDatabase(db);
    seedDemoData(true, db);

    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    const db = getDatabase();
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  describe('Health & Dashboard', () => {
    test('GET /api/health returns 200 and healthy status', async () => {
      const res = await request('GET', '/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'healthy');
      assert.equal(res.body.version, '1.0.0');
    });

    test('GET /api/dashboard/stats returns aggregate metrics', async () => {
      const res = await request('GET', '/api/dashboard/stats');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.projects.total >= 3);
      assert.ok(res.body.data.tasks.total >= 10);
      assert.ok(typeof res.body.data.tasks.completion_rate === 'number');
    });

    test('GET /api/docs/spec returns REST API specification', async () => {
      const res = await request('GET', '/api/docs/spec');
      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'DevFlow REST API Specification');
      assert.ok(Array.isArray(res.body.endpoints));
    });
  });

  describe('Projects CRUD Operations', () => {
    let createdProjectId = null;

    test('POST /api/projects rejects invalid input with 400', async () => {
      const res = await request('POST', '/api/projects', { name: 'A' });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.details.length > 0);
    });

    test('POST /api/projects creates a new project with custom key', async () => {
      const res = await request('POST', '/api/projects', {
        name: 'Infrastructure Modernization',
        key: 'INFRA',
        description: 'Terraform and Kubernetes infrastructure',
        status: 'active',
        deadline: '2027-01-01',
        color: '#10b981'
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.key, 'INFRA');
      assert.equal(res.body.data.name, 'Infrastructure Modernization');
      createdProjectId = res.body.data.id;
    });

    test('POST /api/projects rejects duplicate key with 409 Conflict', async () => {
      const res = await request('POST', '/api/projects', {
        name: 'Another Infra',
        key: 'INFRA'
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
    });

    test('POST /api/projects auto-generates key if omitted', async () => {
      const res = await request('POST', '/api/projects', {
        name: 'Zero Trust Security'
      });
      assert.equal(res.status, 201);
      assert.ok(res.body.data.key.length >= 2);
    });

    test('GET /api/projects lists projects with pagination and search', async () => {
      const res = await request('GET', '/api/projects?search=Infrastructure&page=1&limit=10');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.length >= 1);
      assert.equal(res.body.pagination.page, 1);
    });

    test('GET /api/projects/:id returns single project details with task counts', async () => {
      const res = await request('GET', `/api/projects/${createdProjectId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, createdProjectId);
      assert.ok(Array.isArray(res.body.data.recent_activity));
    });

    test('PUT /api/projects/:id updates project attributes', async () => {
      const res = await request('PUT', `/api/projects/${createdProjectId}`, {
        name: 'Infrastructure Modernization v2',
        description: 'Updated description',
        status: 'active'
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, 'Infrastructure Modernization v2');
    });
  });

  describe('Tasks CRUD Operations', () => {
    let testTaskId = null;
    let targetProjectId = null;

    before(async () => {
      const projRes = await request('GET', '/api/projects?limit=1');
      targetProjectId = projRes.body.data[0].id;
    });

    test('POST /api/tasks rejects invalid input with 400', async () => {
      const res = await request('POST', '/api/tasks', {
        title: 'ab', // too short
        project_id: targetProjectId
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('POST /api/tasks creates task with auto-generated project key', async () => {
      const res = await request('POST', '/api/tasks', {
        project_id: targetProjectId,
        title: 'Configure automated security scanning in CI',
        description: 'Integrate Trivy and Semgrep in GitHub Actions',
        status: 'todo',
        priority: 'high',
        assignee: 'Prakhar',
        due_date: '2026-11-15',
        tags: 'security,ci,devops',
        estimated_hours: 6
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.task_key.includes('-'));
      assert.equal(res.body.data.priority, 'high');
      testTaskId = res.body.data.id;
    });

    test('GET /api/tasks supports multi-criteria filtering and pagination', async () => {
      const res = await request('GET', `/api/tasks?project_id=${targetProjectId}&status=todo&priority=high`);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 1);
      assert.equal(res.body.pagination.page, 1);
    });

    test('GET /api/tasks supports full-text search', async () => {
      const res = await request('GET', '/api/tasks?q=Trivy');
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 1);
      assert.equal(res.body.data[0].id, testTaskId);
    });

    test('GET /api/tasks/:id retrieves task details', async () => {
      const res = await request('GET', `/api/tasks/${testTaskId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, testTaskId);
      assert.equal(res.body.data.title, 'Configure automated security scanning in CI');
    });

    test('PATCH /api/tasks/:id updates status and priority (Kanban drop)', async () => {
      const res = await request('PATCH', `/api/tasks/${testTaskId}`, {
        status: 'in_progress',
        priority: 'urgent'
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'in_progress');
      assert.equal(res.body.data.priority, 'urgent');
    });

    test('DELETE /api/tasks/:id removes task', async () => {
      const res = await request('DELETE', `/api/tasks/${testTaskId}`);
      assert.equal(res.status, 200);

      const check = await request('GET', `/api/tasks/${testTaskId}`);
      assert.equal(check.status, 404);
    });
  });

  describe('Cascade Deletion', () => {
    test('Deleting a project cascades and removes all its tasks', async () => {
      // 1. Create a dummy project
      const pRes = await request('POST', '/api/projects', {
        name: 'Temporary Project',
        key: 'TEMP'
      });
      const pid = pRes.body.data.id;

      // 2. Create a task in that project
      const tRes = await request('POST', '/api/tasks', {
        project_id: pid,
        title: 'Temporary Task to Cascade'
      });
      const tid = tRes.body.data.id;

      // 3. Delete the project
      const delRes = await request('DELETE', `/api/projects/${pid}`);
      assert.equal(delRes.status, 200);

      // 4. Verify task was cascade deleted
      const checkTask = await request('GET', `/api/tasks/${tid}`);
      assert.equal(checkTask.status, 404);
    });
  });
});
