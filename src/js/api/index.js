/* ============================================================
   Aggregated Data Loader
   ============================================================ */
import { getClient } from '../supabase.js';
import { setState } from '../state.js';

export async function loadAllData() {
  try {
    const client = getClient();

    const [projects, tasks, team, resources, members, files, activities] = await Promise.all([
      client.from('projects').select('*').order('created_at', { ascending: false }),
      client.from('tasks').select('*').order('created_at', { ascending: false }),
      client.from('profiles').select('*').order('created_at', { ascending: false }),
      client.from('resources').select('*').order('created_at', { ascending: false }),
      client.from('project_members').select('*'),
      client.from('files').select('*').order('created_at', { ascending: false }),
      client.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
    ]);

    const firstError = [projects, tasks, team, resources, members, files, activities]
      .find(r => r.error)?.error;
    if (firstError) throw firstError;

    setState({
      projects: projects.data || [],
      tasks: tasks.data || [],
      team: team.data || [],
      resources: resources.data || [],
      projectMembers: members.data || [],
      files: files.data || [],
      activities: activities.data || [],
    });
  } catch (error) {
    console.error('Failed to load data:', error);
    throw error;
  }
}

/**
 * Reload only projects and related data
 */
export async function loadProjectsData() {
  try {
    const client = getClient();
    const [projects, members] = await Promise.all([
      client.from('projects').select('*').order('created_at', { ascending: false }),
      client.from('project_members').select('*'),
    ]);
    const firstError = [projects, members].find(r => r.error)?.error;
    if (firstError) throw firstError;
    setState({
      projects: projects.data || [],
      projectMembers: members.data || [],
    });
  } catch (error) {
    console.error('Failed to load projects:', error);
    throw error;
  }
}

/**
 * Reload only tasks and related data
 */
export async function loadTasksData() {
  try {
    const client = getClient();
    const tasks = await client.from('tasks').select('*').order('created_at', { ascending: false });
    if (tasks.error) throw tasks.error;
    setState({ tasks: tasks.data || [] });
  } catch (error) {
    console.error('Failed to load tasks:', error);
    throw error;
  }
}

/**
 * Reload only team and related data
 */
export async function loadTeamData() {
  try {
    const client = getClient();
    const team = await client.from('profiles').select('*').order('created_at', { ascending: false });
    if (team.error) throw team.error;
    setState({ team: team.data || [] });
  } catch (error) {
    console.error('Failed to load team:', error);
    throw error;
  }
}

/**
 * Reload only resources and related data
 */
export async function loadResourcesData() {
  try {
    const client = getClient();
    const resources = await client.from('resources').select('*').order('created_at', { ascending: false });
    if (resources.error) throw resources.error;
    setState({ resources: resources.data || [] });
  } catch (error) {
    console.error('Failed to load resources:', error);
    throw error;
  }
}

/**
 * Reload only files and related data
 */
export async function loadFilesData() {
  try {
    const client = getClient();
    const files = await client.from('files').select('*').order('created_at', { ascending: false });
    if (files.error) throw files.error;
    setState({ files: files.data || [] });
  } catch (error) {
    console.error('Failed to load files:', error);
    throw error;
  }
}

/**
 * Reload only activities
 */
export async function loadActivitiesData() {
  try {
    const client = getClient();
    const activities = await client.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (activities.error) throw activities.error;
    setState({ activities: activities.data || [] });
  } catch (error) {
    console.error('Failed to load activities:', error);
    throw error;
  }
}
