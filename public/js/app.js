/**
 * DevFlow Application Coordinator
 * State management, views switching, event routing
 */

import { api } from './api.js';
import { debounce, escapeHtml } from './utils.js';
import { showToast } from './components/toast.js';
import { renderKanbanBoard } from './components/board.js';
import { renderTable } from './components/table.js';
import { renderProjects } from './components/projects.js';
import {
  initModals,
  openTaskModal,
  openProjectModal,
  openTaskDetailModal,
  openConfirmModal
} from './components/modals.js';

class DevFlowApp {
  constructor() {
    this.state = {
      activeView: 'kanban',
      activeProjectId: '',
      searchQuery: '',
      priorityFilter: '',
      statusFilter: '',
      overdueOnly: false,
      tablePage: 1,
      tableLimit: 20,
      tableSort: 'created_at',
      tableOrder: 'desc',
      projects: [],
      tasks: [],
      tablePagination: null,
      stats: null
    };

    this.modalManager = null;
  }

  async init() {
    this.initModals();
    this.bindEvents();
    await this.loadInitialData();
  }

  initModals() {
    this.modalManager = initModals({
      onTaskSaved: async (taskData) => {
        try {
          if (taskData.id) {
            await api.updateTask(taskData.id, taskData);
            showToast('Task updated successfully', 'success');
          } else {
            await api.createTask(taskData);
            showToast('New task created', 'success');
          }
          await this.refreshData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      onProjectSaved: async (projData) => {
        try {
          if (projData.id) {
            await api.updateProject(projData.id, projData);
            showToast('Project updated successfully', 'success');
          } else {
            await api.createProject(projData);
            showToast('New project created', 'success');
          }
          await this.loadProjects();
          await this.refreshData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      onTaskDeleted: async (taskId) => {
        try {
          await api.deleteTask(taskId);
          showToast('Task deleted', 'success');
          await this.refreshData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      onOpenEditTask: (task) => {
        openTaskModal(task, this.state.projects, task.status, this.state.activeProjectId);
      }
    });
  }

  bindEvents() {
    // View Tab Navigation
    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        this.switchView(view);
      });
    });

    // Top Action Buttons
    document.getElementById('btnNewTask')?.addEventListener('click', () => {
      openTaskModal(null, this.state.projects, 'todo', this.state.activeProjectId);
    });

    document.getElementById('btnNewProject')?.addEventListener('click', () => {
      openProjectModal(null);
    });

    document.getElementById('btnCreateProjectModal')?.addEventListener('click', () => {
      openProjectModal(null);
    });

    document.getElementById('btnSeedData')?.addEventListener('click', () => {
      openConfirmModal('Reset workspace to demo data with sample projects and tasks?', async () => {
        try {
          await api.seedData(true);
          showToast('Database reset and seeded with demo data', 'success');
          await this.loadProjects();
          await this.refreshData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Project Workspace Selector
    const projectSelector = document.getElementById('projectSelector');
    if (projectSelector) {
      projectSelector.addEventListener('change', async (e) => {
        this.state.activeProjectId = e.target.value;
        this.state.tablePage = 1;
        await this.refreshData();
      });
    }

    // Search Input with Debounce
    const searchInput = document.getElementById('searchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');

    if (searchInput) {
      const debouncedSearch = debounce(async (val) => {
        this.state.searchQuery = val.trim();
        this.state.tablePage = 1;
        await this.loadTasks();
      }, 300);

      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (btnClearSearch) btnClearSearch.hidden = !val;
        debouncedSearch(val);
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', async () => {
        searchInput.value = '';
        btnClearSearch.hidden = true;
        this.state.searchQuery = '';
        this.state.tablePage = 1;
        await this.loadTasks();
      });
    }

    // Filter Controls
    document.getElementById('filterPriority')?.addEventListener('change', async (e) => {
      this.state.priorityFilter = e.target.value;
      this.state.tablePage = 1;
      await this.loadTasks();
    });

    document.getElementById('filterStatus')?.addEventListener('change', async (e) => {
      this.state.statusFilter = e.target.value;
      this.state.tablePage = 1;
      await this.loadTasks();
    });

    document.getElementById('toggleOverdue')?.addEventListener('change', async (e) => {
      this.state.overdueOnly = e.target.checked;
      this.state.tablePage = 1;
      await this.loadTasks();
    });

    document.getElementById('btnResetFilters')?.addEventListener('click', async () => {
      this.state.searchQuery = '';
      this.state.priorityFilter = '';
      this.state.statusFilter = '';
      this.state.overdueOnly = false;
      this.state.tablePage = 1;

      if (searchInput) searchInput.value = '';
      if (btnClearSearch) btnClearSearch.hidden = true;
      const fPrio = document.getElementById('filterPriority');
      if (fPrio) fPrio.value = '';
      const fStatus = document.getElementById('filterStatus');
      if (fStatus) fStatus.value = '';
      const tOverdue = document.getElementById('toggleOverdue');
      if (tOverdue) tOverdue.checked = false;

      await this.loadTasks();
    });

    // Page Size Selector
    document.getElementById('pageSizeSelect')?.addEventListener('change', async (e) => {
      this.state.tableLimit = parseInt(e.target.value, 10);
      this.state.tablePage = 1;
      await this.loadTasks();
    });

    // Table Column Sorting Click
    document.querySelectorAll('#tasksTable th.sortable').forEach(th => {
      th.addEventListener('click', async () => {
        const field = th.dataset.sort;
        if (this.state.tableSort === field) {
          this.state.tableOrder = this.state.tableOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.tableSort = field;
          this.state.tableOrder = 'asc';
        }
        await this.loadTasks();
      });
    });
  }

  switchView(view) {
    this.state.activeView = view;

    // Update Tab Navigation Active State
    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });

    // Toggle View Panels
    const panels = {
      kanban: document.getElementById('viewKanban'),
      table: document.getElementById('viewTable'),
      projects: document.getElementById('viewProjects'),
      docs: document.getElementById('viewDocs')
    };

    const filterToolbar = document.getElementById('filterToolbar');

    for (const [key, panel] of Object.entries(panels)) {
      if (panel) {
        panel.hidden = key !== view;
        panel.classList.toggle('active', key === view);
      }
    }

    // Hide search toolbar for docs & projects view
    if (filterToolbar) {
      filterToolbar.style.display = (view === 'docs' || view === 'projects') ? 'none' : 'flex';
    }

    if (view === 'docs') {
      this.loadApiDocs();
    } else if (view === 'projects') {
      this.loadProjects();
    } else {
      this.loadTasks();
    }
  }

  async loadInitialData() {
    await this.loadProjects();
    await this.refreshData();
  }

  async refreshData() {
    await Promise.all([
      this.loadDashboardStats(),
      this.loadTasks()
    ]);
  }

  async loadProjects() {
    try {
      const res = await api.getProjects({ limit: 100 });
      this.state.projects = res.data || [];

      // Update workspace selector dropdown
      const selector = document.getElementById('projectSelector');
      if (selector) {
        const currentVal = this.state.activeProjectId;
        selector.innerHTML = `
          <option value="">All Projects Workspace</option>
          ${this.state.projects.map(p => `
            <option value="${p.id}" ${String(p.id) === String(currentVal) ? 'selected' : ''}>
              ${escapeHtml(p.name)} (${escapeHtml(p.key)})
            </option>
          `).join('')}
        `;
      }

      if (this.state.activeView === 'projects') {
        renderProjects({
          projects: this.state.projects,
          onSelectProject: (id) => {
            this.state.activeProjectId = String(id);
            if (selector) selector.value = String(id);
            this.switchView('kanban');
            this.refreshData();
          },
          onEditProject: (project) => {
            openProjectModal(project);
          },
          onDeleteProject: (project) => {
            openConfirmModal(`Delete project '${project.name}' and all associated tasks?`, async () => {
              try {
                await api.deleteProject(project.id);
                showToast(`Project '${project.name}' deleted`, 'success');
                if (this.state.activeProjectId === String(project.id)) {
                  this.state.activeProjectId = '';
                  if (selector) selector.value = '';
                }
                await this.loadProjects();
                await this.refreshData();
              } catch (err) {
                showToast(err.message, 'error');
              }
            });
          }
        });
      }
    } catch (err) {
      showToast('Failed to load projects: ' + err.message, 'error');
    }
  }

  async loadDashboardStats() {
    try {
      const res = await api.getDashboardStats();
      const stats = res.data;
      this.state.stats = stats;

      // Update metric counter cards
      document.getElementById('valTotalTasks').textContent = stats.tasks.total;
      document.getElementById('valTotalProjects').textContent = stats.projects.active;
      document.getElementById('valInProgress').textContent = stats.tasks.in_progress;
      document.getElementById('valReview').textContent = stats.tasks.review;
      document.getElementById('valCompleted').textContent = stats.tasks.done;
      document.getElementById('valCompletionRate').textContent = `${stats.tasks.completion_rate}%`;
      
      const pBar = document.getElementById('progressBarCompletion');
      if (pBar) pBar.style.width = `${stats.tasks.completion_rate}%`;

      document.getElementById('valOverdue').textContent = stats.tasks.overdue;
      const overdueSub = document.getElementById('subtextOverdue');
      if (overdueSub) {
        overdueSub.textContent = stats.tasks.overdue > 0 ? `${stats.tasks.overdue} tasks need attention` : 'All tasks on schedule';
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  async loadTasks() {
    try {
      const params = {
        page: this.state.tablePage,
        limit: this.state.activeView === 'kanban' ? 100 : this.state.tableLimit,
        sort: this.state.tableSort,
        order: this.state.tableOrder
      };

      if (this.state.activeProjectId) params.project_id = this.state.activeProjectId;
      if (this.state.priorityFilter) params.priority = this.state.priorityFilter;
      if (this.state.statusFilter) params.status = this.state.statusFilter;
      if (this.state.overdueOnly) params.overdue = 'true';
      if (this.state.searchQuery) params.q = this.state.searchQuery;

      const res = await api.getTasks(params);
      this.state.tasks = res.data || [];
      this.state.tablePagination = res.pagination || null;

      if (this.state.activeView === 'kanban') {
        renderKanbanBoard({
          tasks: this.state.tasks,
          onStatusChange: async (taskId, newStatus) => {
            try {
              await api.patchTask(taskId, { status: newStatus });
              showToast(`Task status updated to ${newStatus}`, 'success');
              await this.refreshData();
            } catch (err) {
              showToast(err.message, 'error');
            }
          },
          onCardClick: async (task) => {
            try {
              const fullTaskRes = await api.getTask(task.id);
              openTaskDetailModal(fullTaskRes.data, this.modalManager);
            } catch (err) {
              openTaskDetailModal(task, this.modalManager);
            }
          },
          onAddTask: (status) => {
            openTaskModal(null, this.state.projects, status, this.state.activeProjectId);
          }
        });
      } else if (this.state.activeView === 'table') {
        renderTable({
          tasks: this.state.tasks,
          pagination: this.state.tablePagination,
          onSortChange: async (field) => {
            this.state.tableSort = field;
            await this.loadTasks();
          },
          onPageChange: async (newPage) => {
            this.state.tablePage = newPage;
            await this.loadTasks();
          },
          onEditTask: (task) => {
            openTaskModal(task, this.state.projects, task.status, this.state.activeProjectId);
          },
          onDeleteTask: (task) => {
            openConfirmModal(`Delete task ${task.task_key} (${task.title})?`, async () => {
              try {
                await api.deleteTask(task.id);
                showToast(`Task ${task.task_key} deleted`, 'success');
                await this.refreshData();
              } catch (err) {
                showToast(err.message, 'error');
              }
            });
          },
          onRowClick: async (task) => {
            try {
              const fullTaskRes = await api.getTask(task.id);
              openTaskDetailModal(fullTaskRes.data, this.modalManager);
            } catch (err) {
              openTaskDetailModal(task, this.modalManager);
            }
          }
        });
      }
    } catch (err) {
      showToast('Failed to load tasks: ' + err.message, 'error');
    }
  }

  async loadApiDocs() {
    const container = document.getElementById('docsContent');
    if (!container) return;

    try {
      const spec = await api.getApiSpec();
      let html = '';

      spec.endpoints.forEach(group => {
        html += `
          <div class="docs-group">
            <h3 class="docs-group-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span>${escapeHtml(group.group)}</span>
            </h3>
        `;

        group.routes.forEach(route => {
          const methodClass = `method-${route.method.toLowerCase()}`;
          const paramsHtml = route.parameters.length > 0 ? `
            <table class="docs-params-table">
              <thead>
                <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                ${route.parameters.map(p => `
                  <tr>
                    <td><code>${escapeHtml(p.name)}</code></td>
                    <td><span style="color: var(--accent-amber)">${escapeHtml(p.type)}</span></td>
                    <td>${escapeHtml(p.description)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px;">No parameters required.</p>';

          html += `
            <div class="endpoint-card">
              <div class="endpoint-header">
                <span class="http-method ${methodClass}">${escapeHtml(route.method)}</span>
                <span class="endpoint-path">${escapeHtml(route.path)}</span>
              </div>
              <p class="endpoint-desc">${escapeHtml(route.description)}</p>
              ${paramsHtml}
              <div style="margin-top: 8px;">
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Example Response (200 OK):</span>
                <pre class="code-preview">${escapeHtml(JSON.stringify(route.response, null, 2))}</pre>
              </div>
            </div>
          `;
        });

        html += `</div>`;
      });

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<p class="text-danger">Failed to load API documentation: ${escapeHtml(err.message)}</p>`;
    }
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new DevFlowApp();
  app.init();
});
