/**
 * DevFlow API Client
 * Wraps REST HTTP calls with structured error handling
 */

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.details = data?.error?.details || null;
    throw error;
  }

  return data;
}

export const api = {
  // Dashboard
  getDashboardStats: () => request('/dashboard/stats'),
  seedData: (force = false) => request(`/dashboard/seed?force=${force}`, { method: 'POST' }),

  // Projects
  getProjects: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/projects${query ? `?${query}` : ''}`);
  },
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: data }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/tasks${query ? `?${query}` : ''}`);
  },
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: data }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
  patchTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // API Docs Spec
  getApiSpec: () => request('/docs/spec')
};
