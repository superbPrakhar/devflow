/**
 * Kanban Board Component
 * Features drag-and-drop workflow status updates
 */

import { escapeHtml, getDeadlineBadge, getPriorityBadge, getInitials } from '../utils.js';

const COLUMNS = [
  { id: 'backlog', title: 'Backlog', color: '#64748b' },
  { id: 'todo', title: 'To Do', color: '#6366f1' },
  { id: 'in_progress', title: 'In Progress', color: '#f59e0b' },
  { id: 'review', title: 'Review', color: '#a855f7' },
  { id: 'done', title: 'Done', color: '#10b981' }
];

export function renderKanbanBoard({ tasks, onStatusChange, onCardClick, onAddTask }) {
  const container = document.getElementById('kanbanBoard');
  if (!container) return;

  container.innerHTML = '';

  COLUMNS.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.id);

    const colEl = document.createElement('div');
    colEl.className = 'kanban-column';
    colEl.dataset.status = col.id;

    colEl.innerHTML = `
      <div class="column-header">
        <div class="column-title-group">
          <span class="column-status-dot" style="background-color: ${col.color}"></span>
          <span class="column-title">${col.title}</span>
          <span class="column-count">${colTasks.length}</span>
        </div>
        <button type="button" class="btn-add-column-task" title="Add task to ${col.title}" data-status="${col.id}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
      <div class="column-cards-container" data-status="${col.id}"></div>
    `;

    // Add button handler
    const addBtn = colEl.querySelector('.btn-add-column-task');
    addBtn.addEventListener('click', () => {
      if (onAddTask) onAddTask(col.id);
    });

    const cardsContainer = colEl.querySelector('.column-cards-container');

    // Drag-over and drop events on column
    cardsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      colEl.classList.add('drag-over');
    });

    cardsContainer.addEventListener('dragleave', (e) => {
      if (!colEl.contains(e.relatedTarget)) {
        colEl.classList.remove('drag-over');
      }
    });

    cardsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      colEl.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId && onStatusChange) {
        onStatusChange(parseInt(taskId, 10), col.id);
      }
    });

    // Render individual task cards
    colTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-card ${task.is_overdue ? 'card-overdue' : ''}`;
      card.draggable = true;
      card.dataset.taskId = task.id;

      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', task.id.toString());
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      card.addEventListener('click', (e) => {
        // Prevent click when dragging
        if (!card.classList.contains('dragging') && onCardClick) {
          onCardClick(task);
        }
      });

      const tagsHtml = task.tags 
        ? task.tags.split(',').slice(0, 3).map(t => `<span class="tag-badge">${escapeHtml(t.trim())}</span>`).join('')
        : '';

      card.innerHTML = `
        <div class="card-header">
          <span class="card-key">${escapeHtml(task.task_key)}</span>
          ${getPriorityBadge(task.priority)}
        </div>
        <div class="card-title">${escapeHtml(task.title)}</div>
        ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
        <div class="card-footer">
          <div class="card-project" title="${escapeHtml(task.project_name || '')}">
            <span class="project-dot" style="background-color: ${escapeHtml(task.project_color || '#6366f1')}"></span>
            <span style="font-weight: 500; color: var(--text-secondary);">${escapeHtml(task.project_key || '')}</span>
          </div>
          <div class="card-meta-right">
            ${getDeadlineBadge(task.due_date, task.status)}
            ${task.assignee ? `<div class="assignee-avatar" title="Assignee: ${escapeHtml(task.assignee)}">${getInitials(task.assignee)}</div>` : ''}
          </div>
        </div>
      `;

      cardsContainer.appendChild(card);
    });

    container.appendChild(colEl);
  });
}
