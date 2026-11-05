import {avg} from './utils.js';
export const state={user:null,profile:null,session:null,projects:[],tasks:[],team:[],members:[],files:[],resources:[],activity:[],search:'',f:{}};
export const isAdmin=()=>state.profile?.role==='admin';
export const byId=(a,id)=>a.find(x=>x.id===id);
export const nameOf=id=>byId(state.team,id)?.full_name||'غير مسند';
export const projectName=id=>id?(byId(state.projects,id)?.title||'—'):'مهمة عامة';
const hit=(...a)=>{const q=state.search.trim().toLowerCase();return !q||a.join(' ').toLowerCase().includes(q)};
const me=()=>state.user.id;
export const myTasks=()=>isAdmin()?state.tasks:state.tasks.filter(t=>t.assigned_to===me());
export const visibleTasks=()=>myTasks().filter(t=>hit(t.title,t.description,nameOf(t.assigned_to)));
export function visibleProjects(){let l=state.projects;
  if(!isAdmin()){const ids=new Set(state.members.filter(m=>m.user_id===me()).map(m=>m.project_id));myTasks().forEach(t=>t.project_id&&ids.add(t.project_id));l=l.filter(p=>ids.has(p.id))}
  return l.filter(p=>hit(p.title,p.description))}
export const visibleFiles=()=>(isAdmin()?state.files:state.files.filter(f=>f.uploaded_by===me()||state.members.some(m=>m.project_id===f.project_id&&m.user_id===me())||state.tasks.some(t=>t.id===f.task_id&&t.assigned_to===me()))).filter(f=>hit(f.file_name));
export const canSeeRes=r=>isAdmin()||r.target_user_id===me()||(r.target_user_id==null&&(state.members.some(m=>m.project_id===r.project_id&&m.user_id===me())||!!(r.task_id&&state.tasks.some(t=>t.id===r.task_id&&t.assigned_to===me()))));
export const linksOf=({project_id,task_id})=>state.resources.filter(r=>canSeeRes(r)&&(task_id?r.task_id===task_id:r.project_id===project_id&&!r.task_id));
export const visibleResources=()=>state.resources.filter(r=>canSeeRes(r)&&hit(r.title,r.content));
export const projectProgress=id=>avg(state.tasks.filter(t=>t.project_id===id));
export const canEditRes=r=>isAdmin()||r.created_by===me();
export const canAddLink=({project_id,task_id})=>isAdmin()||(task_id?state.tasks.some(t=>t.id===task_id&&t.assigned_to===me()):state.members.some(m=>m.project_id===project_id&&m.user_id===me())||state.tasks.some(t=>t.project_id===project_id&&t.assigned_to===me()));
