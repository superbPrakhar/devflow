/**
 * Projects Workspace Component
 * Project card grid with progress bars and deadline tracking
 */

import { escapeHtml, formatDate } from '../utils.js';

export function renderProjects({ projects, onSelectProject, onEditProject, onDeleteProject }) {
  const container = document.getElementById('projectsGrid');
  if (!container) return;

  container.innerHTML = '';

  if (projects.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted)">
        No project workspaces created yet. Click "Create New Project" to get started.
      </div>
    `;
    return;
  }

  projects.forEach(project => {
    const card = document.createElement('div');
    card.className = 'project-card';

    const deadlineText = project.deadline ? formatDate(project.deadline) : 'No deadline';
    const progress = project.progress_percentage || 0;

    card.innerHTML = `
      <div class="project-card-header">
        <span class="project-key-tag" style="background-color: ${escapeHtml(project.color || '#4f46e5')}">
          ${escapeHtml(project.key)}
        </span>
        <span class="badge-status status-${escapeHtml(project.status)}">${escapeHtml(project.status)}</span>
      </div>

      <h3 class="project-name">${escapeHtml(project.name)}</h3>
      <p class="project-description">${escapeHtml(project.description || 'No description provided.')}</p>

      <div class="project-metrics-row">
        <span>Progress (${progress}%)</span>
        <span>${project.done_tasks || 0} of ${project.total_tasks || 0} tasks completed</span>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${progress}%; background: ${escapeHtml(project.color || '#4f46e5')}"></div>
      </div>

      <div class="project-metrics-row" style="margin-top: 12px;">
        <span>🎯 Deadline: ${deadlineText}</span>
        ${project.overdue_tasks > 0 ? `<span class="text-danger">⚠️ ${project.overdue_tasks} overdue</span>` : ''}
      </div>

      <div class="project-actions">
        <button type="button" class="btn btn-primary btn-sm btn-view-workspace" data-id="${project.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="5" height="18" rx="1"/>
            <rect x="10" y="3" width="5" height="12" rx="1"/>
            <rect x="17" y="3" width="5" height="15" rx="1"/>
          </svg>
          <span>View Board</span>
        </button>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-ghost btn-sm btn-edit-proj" data-id="${project.id}" title="Edit Project">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-delete-proj" data-id="${project.id}" title="Delete Project" style="color: var(--accent-rose)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    card.querySelector('.btn-view-workspace').addEventListener('click', () => {
      if (onSelectProject) onSelectProject(project.id);
    });

    card.querySelector('.btn-edit-proj').addEventListener('click', () => {
      if (onEditProject) onEditProject(project);
    });

    card.querySelector('.btn-delete-proj').addEventListener('click', () => {
      if (onDeleteProject) onDeleteProject(project);
    });

    container.appendChild(card);
  });
}
