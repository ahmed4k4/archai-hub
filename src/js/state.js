/* ============================================================
   Global State Store — reactive, minimal
   ============================================================ */
import { ROLES } from './config.js';

const state = {
  session: null,
  user: null,
  profile: null,
  projects: [],
  tasks: [],
  team: [],
  resources: [],
  projectMembers: [],
  files: [],
  activities: [],
  activeView: 'dashboard',
  searchTerm: '',
  loading: false,
  // Per-item loading states
  itemLoading: new Map(), // key: `${entity}:${id}` -> boolean
  // Error states
  errors: new Map(), // key: `${entity}:${id}` -> Error
  // Pending mutations for race condition handling
  pendingMutations: new Map(), // key: `${entity}:${id}` -> AbortController
  // Computed caches (invalidated on data change)
  _cache: {
    projectTasks: new Map(), // projectId -> task[]
    userTasks: new Map(), // userId -> task[]
    projectFiles: new Map(), // projectId -> file[]
    taskFiles: new Map(), // taskId -> file[]
    projectMembers: new Map(), // projectId -> member[]
    userProjects: new Set(), // userId -> Set(projectId)
    lastInvalidated: 0,
  },
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  invalidateCache();
  notify();
}

function invalidateCache() {
  state._cache.projectTasks.clear();
  state._cache.userTasks.clear();
  state._cache.projectFiles.clear();
  state._cache.taskFiles.clear();
  state._cache.projectMembers.clear();
  state._cache.userProjects.clear();
  state._cache.lastInvalidated = Date.now();
}

/**
 * Set loading state for a specific item
 */
export function setItemLoading(entity, id, loading) {
  const key = `${entity}:${id}`;
  if (loading) {
    state.itemLoading.set(key, true);
  } else {
    state.itemLoading.delete(key);
  }
  notify();
}

/**
 * Check if item is loading
 */
export function isItemLoading(entity, id) {
  return state.itemLoading.has(`${entity}:${id}`);
}

/**
 * Set error for a specific item
 */
export function setItemError(entity, id, error) {
  const key = `${entity}:${id}`;
  if (error) {
    state.errors.set(key, error);
  } else {
    state.errors.delete(key);
  }
  notify();
}

/**
 * Get error for a specific item
 */
export function getItemError(entity, id) {
  return state.errors.get(`${entity}:${id}`);
}

/**
 * Clear error for a specific item
 */
export function clearItemError(entity, id) {
  state.errors.delete(`${entity}:${id}`);
  notify();
}

/**
 * Register a pending mutation to handle race conditions
 */
export function registerMutation(entity, id, abortController) {
  const key = `${entity}:${id}`;
  // Abort previous mutation if exists
  const existing = state.pendingMutations.get(key);
  if (existing) {
    existing.abort();
  }
  state.pendingMutations.set(key, abortController);
}

/**
 * Complete a mutation
 */
export function completeMutation(entity, id) {
  state.pendingMutations.delete(`${entity}:${id}`);
}

/**
 * Check if there's a pending mutation
 */
export function hasPendingMutation(entity, id) {
  return state.pendingMutations.has(`${entity}:${id}`);
}

export function resetState() {
  setState({
    session: null,
    user: null,
    profile: null,
    projects: [],
    tasks: [],
    team: [],
    resources: [],
    projectMembers: [],
    files: [],
    activities: [],
    activeView: 'dashboard',
    searchTerm: '',
    loading: false,
    itemLoading: new Map(),
    errors: new Map(),
    pendingMutations: new Map(),
  });
}

export function isAdmin() {
  return state.profile?.role === ROLES.ADMIN;
}

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => {
    try { fn(state); } catch (e) { console.error(e); }
  });
}

/**
 * Optimistic update helpers
 */
export function optimisticAdd(entity, item) {
  const arr = state[entity];
  if (Array.isArray(arr)) {
    arr.unshift(item);
    notify();
  }
}

export function optimisticUpdate(entity, id, updates) {
  const arr = state[entity];
  if (Array.isArray(arr)) {
    const idx = arr.findIndex(item => item.id === id);
    if (idx !== -1) {
      arr[idx] = { ...arr[idx], ...updates };
      notify();
    }
  }
}

export function optimisticDelete(entity, id) {
  const arr = state[entity];
  if (Array.isArray(arr)) {
    const idx = arr.findIndex(item => item.id === id);
    if (idx !== -1) {
      arr.splice(idx, 1);
      notify();
    }
  }
}

export function rollbackOptimistic(entity, previousState) {
  state[entity] = previousState;
  notify();
}

/**
 * Cached getters for common queries
 */
export function getTasksByProject(projectId) {
  const cache = state._cache.projectTasks;
  if (cache.has(projectId)) return cache.get(projectId);
  const tasks = state.tasks.filter(t => t.project_id === projectId);
  cache.set(projectId, tasks);
  return tasks;
}

export function getTasksByUser(userId) {
  const cache = state._cache.userTasks;
  if (cache.has(userId)) return cache.get(userId);
  const tasks = state.tasks.filter(t => t.assigned_to === userId);
  cache.set(userId, tasks);
  return tasks;
}

export function getFilesByProject(projectId) {
  const cache = state._cache.projectFiles;
  if (cache.has(projectId)) return cache.get(projectId);
  const files = state.files.filter(f => f.project_id === projectId && !f.task_id);
  cache.set(projectId, files);
  return files;
}

export function getFilesByTask(taskId) {
  const cache = state._cache.taskFiles;
  if (cache.has(taskId)) return cache.get(taskId);
  const files = state.files.filter(f => f.task_id === taskId);
  cache.set(taskId, files);
  return files;
}

export function getMembersByProject(projectId) {
  const cache = state._cache.projectMembers;
  if (cache.has(projectId)) return cache.get(projectId);
  const members = state.projectMembers.filter(m => m.project_id === projectId);
  cache.set(projectId, members);
  return members;
}

export function getUserProjects(userId) {
  const cache = state._cache.userProjects;
  if (cache.has(userId)) return cache.get(userId);
  const projectIds = new Set(
    state.projectMembers
      .filter(m => m.user_id === userId)
      .map(m => m.project_id)
  );
  state.tasks
    .filter(t => t.assigned_to === userId && t.project_id)
    .forEach(t => projectIds.add(t.project_id));
  cache.set(userId, projectIds);
  return projectIds;
}
