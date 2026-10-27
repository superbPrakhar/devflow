/**
 * DevFlow Modal Dialog Manager
 * Compliant with Modern Web Guidance for Native <dialog> Elements
 */

import { escapeHtml, formatDate, getDeadlineBadge, getPriorityBadge, getStatusBadge } from '../utils.js';

let activeConfirmCallback = null;

export function initModals({ onTaskSaved, onProjectSaved, onTaskDeleted, onOpenEditTask }) {
  // Polyfill light-dismiss for browsers lacking native closedby support
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) {
          dialog.close();
        }
      });
    }
  }

  // Hook into close listener to prevent stale returnValues
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () => {
      dialog.returnValue = '';
    });
  }

  // --- Task Modal Handlers ---
  const taskModal = document.getElementById('taskModal');
  const taskForm = document.getElementById('taskForm');
  const btnCloseTaskModal = document.getElementById('btnCloseTaskModal');
  const btnCancelTaskModal = document.getElementById('btnCancelTaskModal');

  const closeTaskModal = () => taskModal.close();
  if (btnCloseTaskModal) btnCloseTaskModal.addEventListener('click', closeTaskModal);
  if (btnCancelTaskModal) btnCancelTaskModal.addEventListener('click', closeTaskModal);

  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(taskForm);
      const data = {
        id: formData.get('taskId') || null,
        title: formData.get('title'),
        project_id: parseInt(formData.get('project_id'), 10),
        status: formData.get('status'),
        priority: formData.get('priority'),
        due_date: formData.get('due_date') || null,
        assignee: formData.get('assignee') || '',
        estimated_hours: formData.get('estimated_hours') ? parseFloat(formData.get('estimated_hours')) : 0,
        tags: formData.get('tags') || '',
        description: formData.get('description') || ''
      };
      if (onTaskSaved) onTaskSaved(data);
      taskModal.close();
    });
  }

  // --- Project Modal Handlers ---
  const projectModal = document.getElementById('projectModal');
  const projectForm = document.getElementById('projectForm');
  const btnCloseProjectModal = document.getElementById('btnCloseProjectModal');
  const btnCancelProjectModal = document.getElementById('btnCancelProjectModal');
  const projectColor = document.getElementById('projectColor');
  const colorHexDisplay = document.getElementById('colorHexDisplay');

  if (projectColor && colorHexDisplay) {
    projectColor.addEventListener('input', (e) => {
      colorHexDisplay.textContent = e.target.value;
    });
  }

  const closeProjectModal = () => projectModal.close();
  if (btnCloseProjectModal) btnCloseProjectModal.addEventListener('click', closeProjectModal);
  if (btnCancelProjectModal) btnCancelProjectModal.addEventListener('click', closeProjectModal);

  if (projectForm) {
    projectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(projectForm);
      const data = {
        id: formData.get('projectId') || null,
        name: formData.get('name'),
        key: formData.get('key') || '',
        status: formData.get('status'),
        deadline: formData.get('deadline') || null,
        color: formData.get('color') || '#4f46e5',
        description: formData.get('description') || ''
      };
      if (onProjectSaved) onProjectSaved(data);
      projectModal.close();
    });
  }

  // --- Task Detail Modal Handlers ---
  const taskDetailModal = document.getElementById('taskDetailModal');
  const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
  const btnCloseDetail = document.getElementById('btnCloseDetail');
  const btnEditCurrentTask = document.getElementById('btnEditCurrentTask');
  const btnDeleteCurrentTask = document.getElementById('btnDeleteCurrentTask');

  let currentDetailTask = null;

  const closeDetailModal = () => taskDetailModal.close();
  if (btnCloseDetailModal) btnCloseDetailModal.addEventListener('click', closeDetailModal);
  if (btnCloseDetail) btnCloseDetail.addEventListener('click', closeDetailModal);

  if (btnEditCurrentTask) {
    btnEditCurrentTask.addEventListener('click', () => {
      taskDetailModal.close();
      if (currentDetailTask && onOpenEditTask) {
        onOpenEditTask(currentDetailTask);
      }
    });
  }

  if (btnDeleteCurrentTask) {
    btnDeleteCurrentTask.addEventListener('click', () => {
      if (!currentDetailTask) return;
      openConfirmModal(`Are you sure you want to delete task ${currentDetailTask.task_key}?`, () => {
        taskDetailModal.close();
        if (onTaskDeleted) onTaskDeleted(currentDetailTask.id);
      });
    });
  }

  // --- Confirm Modal Handlers ---
  const confirmModal = document.getElementById('confirmModal');
  const btnCloseConfirmModal = document.getElementById('btnCloseConfirmModal');
  const btnCancelConfirm = document.getElementById('btnCancelConfirm');
  const btnProceedConfirm = document.getElementById('btnProceedConfirm');

  const closeConfirm = () => {
    activeConfirmCallback = null;
    confirmModal.close();
  };

  if (btnCloseConfirmModal) btnCloseConfirmModal.addEventListener('click', closeConfirm);
  if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirm);

  if (btnProceedConfirm) {
    btnProceedConfirm.addEventListener('click', () => {
      if (activeConfirmCallback) {
        activeConfirmCallback();
      }
      closeConfirm();
    });
  }

  return {
    setCurrentDetailTask: (task) => { currentDetailTask = task; }
  };
}

export function openTaskModal(task = null, projects = [], preselectedStatus = 'todo', preselectedProjectId = '') {
  const modal = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');
  const title = document.getElementById('taskModalTitle');
  const projectSelect = document.getElementById('taskProject');

  // Populate projects dropdown
  projectSelect.innerHTML = projects.map(p => `
    <option value="${p.id}" ${String(p.id) === String(task?.project_id || preselectedProjectId) ? 'selected' : ''}>
      ${escapeHtml(p.name)} (${escapeHtml(p.key)})
    </option>
  `).join('');

  form.reset();

  if (task) {
    title.textContent = `Edit Task ${task.task_key}`;
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskProject').value = task.project_id;
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskDueDate').value = task.due_date || '';
    document.getElementById('taskAssignee').value = task.assignee || '';
    document.getElementById('taskEstimatedHours').value = task.estimated_hours || '';
    document.getElementById('taskTags').value = task.tags || '';
    document.getElementById('taskDescription').value = task.description || '';
  } else {
    title.textContent = 'Create New Task';
    document.getElementById('taskId').value = '';
    document.getElementById('taskStatus').value = preselectedStatus;
    if (preselectedProjectId) {
      document.getElementById('taskProject').value = preselectedProjectId;
    }
  }

  modal.showModal();
}

export function openProjectModal(project = null) {
  const modal = document.getElementById('projectModal');
  const form = document.getElementById('projectForm');
  const title = document.getElementById('projectModalTitle');
  const colorInput = document.getElementById('projectColor');
  const colorDisplay = document.getElementById('colorHexDisplay');

  form.reset();

  if (project) {
    title.textContent = `Edit Project ${project.name}`;
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectKey').value = project.key;
    document.getElementById('projectKey').disabled = true; // Key immutable
    document.getElementById('projectStatus').value = project.status;
    document.getElementById('projectDeadline').value = project.deadline || '';
    colorInput.value = project.color || '#4f46e5';
    colorDisplay.textContent = project.color || '#4f46e5';
    document.getElementById('projectDescription').value = project.description || '';
  } else {
    title.textContent = 'Create New Project';
    document.getElementById('projectId').value = '';
    document.getElementById('projectKey').disabled = false;
    colorInput.value = '#4f46e5';
    colorDisplay.textContent = '#4f46e5';
  }

  modal.showModal();
}

export function openTaskDetailModal(task, modalManager) {
  const modal = document.getElementById('taskDetailModal');
  if (modalManager && modalManager.setCurrentDetailTask) {
    modalManager.setCurrentDetailTask(task);
  }

  document.getElementById('detailTaskKey').textContent = task.task_key;
  document.getElementById('detailProjectPill').textContent = task.project_name || 'Project';
  document.getElementById('detailStatusBadge').outerHTML = `<span id="detailStatusBadge">${getStatusBadge(task.status)}</span>`;
  document.getElementById('detailPriorityBadge').outerHTML = `<span id="detailPriorityBadge">${getPriorityBadge(task.priority)}</span>`;
  document.getElementById('taskDetailTitle').textContent = task.title;

  document.getElementById('detailAssignee').textContent = task.assignee || 'Unassigned';
  document.getElementById('detailDeadline').innerHTML = getDeadlineBadge(task.due_date, task.status);
  document.getElementById('detailEffort').textContent = task.estimated_hours ? `${task.estimated_hours} hrs` : 'None specified';
  
  const tagsContainer = document.getElementById('detailTags');
  if (task.tags && task.tags.trim()) {
    tagsContainer.innerHTML = task.tags.split(',').map(t => `<span class="tag-badge">${escapeHtml(t.trim())}</span>`).join(' ');
  } else {
    tagsContainer.textContent = 'No tags';
  }

  document.getElementById('detailDescription').textContent = task.description || 'No description provided.';

  // Render recent activity
  const timeline = document.getElementById('detailTimeline');
  if (task.recent_activity && task.recent_activity.length > 0) {
    timeline.innerHTML = task.recent_activity.map(a => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-text">${escapeHtml(a.details || a.action)}</div>
        <div class="timeline-time">${new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `).join('');
  } else {
    timeline.innerHTML = `<div class="timeline-item"><div class="timeline-text" style="color: var(--text-muted)">No recent activity recorded for this task.</div></div>`;
  }

  modal.showModal();
}

export function openConfirmModal(message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmMessage').textContent = message;
  activeConfirmCallback = onConfirm;
  modal.showModal();
}
