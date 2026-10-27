/**
 * Data Table Component
 * List view with sorting, pagination, and action controls
 */

import { escapeHtml, getDeadlineBadge, getPriorityBadge, getStatusBadge } from '../utils.js';

export function renderTable({ tasks, pagination, onSortChange, onPageChange, onEditTask, onDeleteTask, onRowClick }) {
  const tbody = document.getElementById('tasksTableBody');
  const pageRange = document.getElementById('pageRange');
  const totalItems = document.getElementById('totalItems');
  const pageDisplay = document.getElementById('pageDisplay');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');

  if (!tbody) return;

  tbody.innerHTML = '';

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted)">
          No tasks found matching the selected criteria.
        </td>
      </tr>
    `;
  } else {
    tasks.forEach(task => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="task-table-key">${escapeHtml(task.task_key)}</span></td>
        <td><span class="task-table-title">${escapeHtml(task.title)}</span></td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            <span class="project-dot" style="background-color: ${escapeHtml(task.project_color || '#6366f1')}"></span>
            <span>${escapeHtml(task.project_name || '')}</span>
          </span>
        </td>
        <td>${getStatusBadge(task.status)}</td>
        <td>${getPriorityBadge(task.priority)}</td>
        <td>${escapeHtml(task.assignee || 'Unassigned')}</td>
        <td>${getDeadlineBadge(task.due_date, task.status)}</td>
        <td class="text-right" style="white-space: nowrap;">
          <button type="button" class="btn btn-ghost btn-sm btn-action-edit" data-id="${task.id}" title="Edit Task">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-action-delete" data-id="${task.id}" title="Delete Task" style="color: var(--accent-rose)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        // Ignore if clicking on an action button
        if (e.target.closest('.btn-action-edit') || e.target.closest('.btn-action-delete')) return;
        if (onRowClick) onRowClick(task);
      });

      const editBtn = tr.querySelector('.btn-action-edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onEditTask) onEditTask(task);
      });

      const deleteBtn = tr.querySelector('.btn-action-delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onDeleteTask) onDeleteTask(task);
      });

      tbody.appendChild(tr);
    });
  }

  // Update pagination UI
  if (pagination) {
    const { page, limit, total, totalPages } = pagination;
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    if (pageRange) pageRange.textContent = `${start}-${end}`;
    if (totalItems) totalItems.textContent = total;
    if (pageDisplay) pageDisplay.textContent = `Page ${page} of ${totalPages || 1}`;

    if (btnPrev) {
      btnPrev.disabled = page <= 1;
      btnPrev.onclick = () => onPageChange(page - 1);
    }
    if (btnNext) {
      btnNext.disabled = page >= totalPages;
      btnNext.onclick = () => onPageChange(page + 1);
    }
  }
}
