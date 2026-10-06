/* ============================================================
   Activity Log API
   ============================================================ */
import { getClient } from '../supabase.js';
import { getState, isAdmin } from '../state.js';

export async function logActivity({ projectId = null, taskId = null, action, description }) {
  const { user } = getState();
  if (!user) return;
  
  // Check authorization for project-scoped activities
  if (projectId && !isAdmin()) {
    const state = getState();
    const isMember = state.projectMembers.some(m => m.project_id === projectId && m.user_id === user.id);
    if (!isMember) {
      console.warn('Activity log failed: User not a member of project');
      return;
    }
  }
  
  const { error } = await getClient()
    .from('activity_logs')
    .insert([{
      project_id: projectId,
      task_id: taskId,
      user_id: user.id,
      action,
      description,
    }]);
  if (error) console.warn('Activity log failed:', error);
}
