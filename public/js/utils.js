/**
 * DevFlow Utility Functions
 */

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function formatDate(dateString) {
  if (!dateString) return 'No deadline';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return dateString;
}

export function getDeadlineBadge(dueDateString, status) {
  if (!dueDateString) {
    return `<span class="deadline-badge">No due date</span>`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dueDateString.split('-');
  const due = new Date(parts[0], parts[1] - 1, parts[2]);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (status === 'done') {
    return `<span class="deadline-badge">${formatDate(dueDateString)}</span>`;
  }

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return `<span class="deadline-badge overdue" title="Passed deadline">⚠️ ${daysAgo}d overdue</span>`;
  } else if (diffDays === 0) {
    return `<span class="deadline-badge soon" title="Due today">⚡ Due today</span>`;
  } else if (diffDays === 1) {
    return `<span class="deadline-badge soon" title="Due tomorrow">⏰ Due tomorrow</span>`;
  } else if (diffDays <= 5) {
    return `<span class="deadline-badge soon" title="Due soon">In ${diffDays} days</span>`;
  } else {
    return `<span class="deadline-badge">${formatDate(dueDateString)}</span>`;
  }
}

export function getPriorityBadge(priority) {
  const p = (priority || 'medium').toLowerCase();
  const labels = {
    urgent: '🔴 Urgent',
    high: '🟠 High',
    medium: '🟡 Medium',
    low: '🟢 Low'
  };
  return `<span class="badge-priority prio-${escapeHtml(p)}">${labels[p] || p}</span>`;
}

export function getStatusBadge(status) {
  const s = (status || 'todo').toLowerCase();
  const labels = {
    backlog: 'Backlog',
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done'
  };
  return `<span class="badge-status status-${escapeHtml(s)}">${labels[s] || s}</span>`;
}

export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
