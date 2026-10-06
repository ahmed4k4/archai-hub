/* ============================================================
   Views Renderer
   ============================================================ */
import { renderDashboard } from './dashboard.js';
import { renderProjects } from './projects.js';
import { renderTasks } from './tasks.js';
import { renderTeam } from './team.js';
import { renderResources } from './resources.js';
import { populateSelects } from '../forms/selects.js';
import { getState } from '../state.js';

export function renderAllViews() {
  const state = getState();
  if (!state.profile) return;

  try {
    renderDashboard();
    renderProjects();
    renderTasks();
    renderTeam();
    renderResources();
    populateSelects();
  } catch (err) {
    console.error('Render error:', err);
  }
}
