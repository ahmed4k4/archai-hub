import {state,isAdmin,byId,nameOf,projectName,visibleTasks,visibleProjects,linksOf} from '../lib/store.js';
import {esc,fmtDate,$,overdue} from '../lib/utils.js';
import {t} from '../lib/i18n.js';
import {NEXT} from '../config.js';
import {bar,empty,badge,form,openModal,head,confirmBox,run,app,toast} from '../ui/ui.js';
import {tbl,log,upload,delTask} from '../services/api.js';
import {PR,prBadge} from './projects.js';
import {fileRow,upForm,linkRow,parseLinks,saveLinks} from './resources.js';
export const TS=[['todo','قيد الانتظار'],['in_progress','قيد التنفيذ'],['completed','مكتملة']];
const can=x=>isAdmin()||x.assigned_to===state.user.id,NL={todo:'بدء العمل',in_progress:'إتمام',completed:'إرجاع للانتظار'};
const card=x=>`<article class="card tk" draggable="${can(x)}" data-id="${esc(x.id)}" data-a="t-open"><div class="row nb"><b>${esc(x.title)}</b>${prBadge(x.priority)}</div>
 <small>${esc(projectName(x.project_id))} • ${esc(nameOf(x.assigned_to))}</small>${bar(x.progress||0)}
 <div class="row nb"><small class="${overdue(x)?'bad-t':''}"><i class="fa-regular fa-calendar"></i> ${fmtDate(x.due_date)}</small><small><i class="fa-regular fa-file-pdf"></i> ${state.files.filter(f=>f.task_id===x.id).length} <i class="fa-solid fa-link"></i> ${linksOf({task_id:x.id}).length}</small>${can(x)?`<button class="btn sm" data-a="t-next" data-id="${esc(x.id)}">${t(NL[x.status])}</button>`:''}</div></article>`;
const DEF={p:'',u:'',s:[],pr:[],from:'',to:'',quick:'',sort:'due'},KEY='archai-tk-filter';
const F=()=>state.f.tk??={...DEF,...(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}})()};
const saveF=()=>{try{localStorage.setItem(KEY,JSON.stringify(F()))}catch{}};
const activeCount=()=>{const f=F();return (f.p?1:0)+(f.u?1:0)+f.s.length+f.pr.length+(f.from?1:0)+(f.to?1:0)+(f.quick?1:0)};
const PO={urgent:0,high:1,medium:2,low:3},D=x=>x.due_date?+new Date(x.due_date):1e15;
const SORTS={due:(a,b)=>D(a)-D(b),prio:(a,b)=>PO[a.priority]-PO[b.priority]||D(a)-D(b),prog:(a,b)=>(b.progress||0)-(a.progress||0),new:(a,b)=>new Date(b.created_at)-new Date(a.created_at)};
export function filtered(){const f=F(),now=+new Date(new Date().toDateString()),wk=now+7*864e5;
  return visibleTasks().filter(x=>{const d=x.due_date?+new Date(x.due_date):null;
    if(f.p&&(f.p==='_'?x.project_id:x.project_id!==f.p))return false;
    if(f.u&&x.assigned_to!==f.u)return false;
    if(f.s.length&&!f.s.includes(x.status))return false;
    if(f.pr.length&&!f.pr.includes(x.priority))return false;
    if(f.from&&(d===null||d<+new Date(f.from)))return false;
    if(f.to&&(d===null||d>+new Date(f.to)))return false;
    if(f.quick==='late'&&!overdue(x))return false;
    if(f.quick==='today'&&d!==now)return false;
    if(f.quick==='week'&&!(d!==null&&d>=now&&d<=wk))return false;
    if(f.quick==='nodate'&&d!==null)return false;
    if(f.quick==='mine'&&x.assigned_to!==state.user.id)return false;
    return true}).sort(SORTS[f.sort]||SORTS.due)}
function panel(all,shown){const f=F(),n=activeCount(),open=state.f.tkOpen!==false,users=state.team.filter(u=>u.role==='user');
  const chip=(k,v,l,on)=>`<button class="fchip ${on?'on':''}" data-a="tf-t" data-k="${k}" data-v="${v}">${t(l)}</button>`;
  const sel=(k,o,all0)=>`<select data-ch="tf-set" data-k="${k}">${all0?`<option value="">${t('الكل')}</option>`:''}${o.map(([v,l])=>`<option value="${esc(v)}" ${f[k]===v?'selected':''}>${esc(t(l))}</option>`).join('')}</select>`;
  return `<div class="card fpanel"><div class="fp-h"><b><i class="fa-solid fa-sliders"></i> ${t('الفلاتر')}${n?` <span class="badge on">${n}</span>`:''}</b><span class="muted fp-c">${shown} / ${all} ${t('نتيجة')}</span><span class="actions">${n?`<button class="btn sm" data-a="tf-clear"><i class="fa-solid fa-filter-circle-xmark"></i> ${t('مسح الكل')}</button>`:''}<button class="icon" data-a="tf-open" aria-label="toggle"><i class="fa-solid fa-chevron-${open?'up':'down'}"></i></button></span></div>
  ${open?`<div class="fp-g"><label>${t('المشروع')}${sel('p',[['_','مهمة عامة'],...state.projects.map(p=>[p.id,p.title])],1)}</label>${isAdmin()?`<label>${t('المسؤول')}${sel('u',users.map(u=>[u.id,u.full_name||u.email]),1)}</label>`:''}<label>${t('من')}<input type="date" data-ch="tf-set" data-k="from" value="${esc(f.from)}"></label><label>${t('إلى')}<input type="date" data-ch="tf-set" data-k="to" value="${esc(f.to)}"></label><label>${t('ترتيب')}${sel('sort',[['due','الأقرب تسليمًا'],['prio','الأولوية'],['prog','الأعلى تقدمًا'],['new','الأحدث']])}</label></div>
  <div class="fp-r"><span class="lbl">${t('الحالة')}</span>${TS.map(([k,l])=>chip('s',k,l,f.s.includes(k))).join('')}</div>
  <div class="fp-r"><span class="lbl">${t('الأولوية')}</span>${PR.map(([k,l])=>chip('pr',k,l,f.pr.includes(k))).join('')}</div>
  <div class="fp-r"><span class="lbl">${t('سريع')}</span>${[['late','متأخرة'],['today','اليوم'],['week','هذا الأسبوع'],['nodate','بدون موعد'],['mine','مهامي فقط']].map(([k,l])=>chip('quick',k,l,f.quick===k)).join('')}</div>`:''}</div>`}
export const taskTable=(ts,showP=true)=>ts.length?`<div class="tbl"><div class="tr th"><span>${t('العنوان')}</span><span>${t('المسؤول')}</span><span>${t('الأولوية')}</span><span>${t('التسليم')}</span><span>${t('التقدم %')}</span><span></span></div>${ts.map(x=>`<div class="tr" data-a="t-open" data-id="${esc(x.id)}"><span><b>${esc(x.title)}</b>${showP?`<br><small>${esc(projectName(x.project_id))}</small>`:''}<br>${badge('st-'+x.status,TS.find(s=>s[0]===x.status)[1])}</span><span class="who"><i class="avatar xs">${esc(nameOf(x.assigned_to)[0])}</i>${esc(nameOf(x.assigned_to))}</span><span>${prBadge(x.priority)}</span><span class="${overdue(x)?'bad-t':''}">${fmtDate(x.due_date)}</span><span>${bar(x.progress||0)}<small>${x.progress||0}%</small></span><span>${can(x)?`<button class="btn sm" data-a="t-next" data-id="${esc(x.id)}">${t(NL[x.status])}</button>`:''}</span></div>`).join('')}</div>`:empty('fa-inbox','لا توجد مهام');
export function render(){
  const ts=filtered(),list=state.f.tv==='list',all=visibleTasks().length;
  return `<div class="head"><span class="seg"><button data-a="tv" data-v="board" class="${list?'':'on'}"><i class="fa-solid fa-table-columns"></i> ${t('لوحة')}</button><button data-a="tv" data-v="list" class="${list?'on':''}"><i class="fa-solid fa-list"></i> ${t('قائمة')}</button></span>
  <span class="actions"><button class="btn" data-a="csv"><i class="fa-solid fa-download"></i> ${t('تصدير CSV')}</button>${isAdmin()?`<button class="btn primary" data-a="t-new">+ ${t('مهمة جديدة')}</button>`:''}</span></div>${panel(all,ts.length)}
  ${list?TS.map(([k,l])=>{const c=ts.filter(x=>x.status===k);return `<div class="card gap"><h4>${t(l)} <span class="badge">${c.length}</span></h4>${taskTable(c)}</div>`}).join(''):
  `<div class="kanban">${TS.map(([k,l])=>{const c=ts.filter(x=>x.status===k);return `<div class="kcol" data-drop="${k}"><h3>${t(l)} <span class="badge">${c.length}</span></h3><div class="col">${c.map(card).join('')||empty('fa-inbox')}</div></div>`}).join('')}</div>`}`;
}
export function details(id){
  const x=byId(state.tasks,id);if(!x)return;const fs=state.files.filter(f=>f.task_id===id),ls=linksOf({task_id:id}),ac=state.activity.filter(a=>a.task_id===id);
  const m=(l,v)=>`<div class="meta"><small>${t(l)}</small><b>${v}</b></div>`;
  openModal(head(x.title)+`<div class="row nb"><span>${badge('st-'+x.status,TS.find(s=>s[0]===x.status)[1])} ${prBadge(x.priority)}</span><small>${esc(projectName(x.project_id))}</small></div>
  <div class="metas">${m('المسؤول',`<span class="who"><i class="avatar xs">${esc(nameOf(x.assigned_to)[0])}</i>${esc(nameOf(x.assigned_to))}</span>`)}${m('التسليم',`<span class="${overdue(x)?'bad-t':''}">${fmtDate(x.due_date)}</span>`)}${m('أنشأها',esc(nameOf(x.created_by)))}${m('آخر تحديث',fmtDate(x.updated_at||x.created_at,1))}</div>
  <h4>${t('الوصف')}</h4><p class="wrap box">${esc(x.description||'—')}</p>
  <div class="row nb"><h4>${t('التقدم %')}</h4><b>${x.progress||0}%</b></div>${can(x)?`<input type="range" min="0" max="100" step="5" value="${x.progress||0}" data-ch="t-prog" data-id="${esc(id)}">`:bar(x.progress||0)}
  <div class="actions" style="margin:14px 0">${can(x)?`<button class="btn primary" data-a="t-next" data-id="${esc(id)}" data-re="1">${t(NL[x.status])}</button>`:''}${isAdmin()?`<button class="btn" data-a="t-edit" data-id="${esc(id)}">${t('تعديل')}</button><button class="btn" data-a="f-up-t" data-id="${esc(id)}">${t('رفع PDF')}</button><button class="btn danger" data-a="t-del" data-id="${esc(id)}">${t('حذف')}</button>`:''}</div>
  <h4>${t('الملفات')} <span class="badge">${fs.length}</span></h4>${fs.map(fileRow).join('')||empty('fa-file-circle-xmark')}
  <div class="row nb" style="margin-top:16px"><h4>${t('الروابط')} <span class="badge">${ls.length}</span></h4>${can(x)?`<button class="btn sm" data-a="r-new-t" data-id="${esc(id)}">+ ${t('إضافة رابط')}</button>`:''}</div>${ls.map(r=>linkRow(r)).join('')||empty('fa-link-slash')}
  <h4 style="margin-top:16px">${t('النشاط')}</h4><div class="comment"><textarea id="c-in" rows="2" placeholder="${t('أضف تعليقًا...')}"></textarea><button class="btn primary" data-a="t-comment" data-id="${esc(id)}">${t('إرسال')}</button></div>
  ${ac.map(a=>`<div class="tl-i"><i class="fa-solid ${a.action==='comment'?'fa-comment':'fa-circle-dot'}"></i><div><b>${esc(nameOf(a.user_id))}</b> <small>${fmtDate(a.created_at,1)}</small><p class="wrap">${esc(a.description||a.action)}</p></div></div>`).join('')}`,true);
}
export const setStatus=async(id,status)=>{const x=byId(state.tasks,id);if(!x||!can(x)||x.status===status)return;
  await run(async()=>{await tbl('tasks').set(id,{status,progress:status==='completed'?100:status==='todo'?0:Math.max(x.progress||0,10)});await log(x.project_id,id,'task_status_changed',`${x.title}: ${status}`)});await app.reload()};
export function tform(id,pre={}){const x=id?byId(state.tasks,id):pre,users=state.team.filter(u=>u.role==='user');
  form({title:id?'تعديل':'مهمة جديدة',init:x,fields:[{k:'title',l:'العنوان',req:1},{k:'description',l:'الوصف',t:'textarea'},{k:'project_id',l:'المشروع',t:'select',o:[['','مهمة عامة'],...state.projects.map(p=>[p.id,p.title])]},{k:'assigned_to',l:'المسؤول',t:'select',req:1,o:[['','—'],...users.map(u=>[u.id,u.full_name||u.email])]},{k:'priority',l:'الأولوية',t:'select',o:PR,def:'medium'},{k:'due_date',l:'التسليم',t:'date'},
   ...(id?[{k:'status',l:'الحالة',t:'select',o:TS},{k:'progress',l:'التقدم %',t:'number'}]:[{k:'files',l:'اختر ملف PDF (حتى 10MB)',t:'file',acc:'application/pdf',multi:1}]),{k:'links',l:'إضافة روابط (اختياري)',t:'textarea',ph:'سطر لكل رابط: عنوان | رابط'}],
  onSubmit:async v=>{if(!v.assigned_to)throw new Error('اختر المسؤول');const{files,links,...b}=v;const lr=parseLinks(links);b.project_id=b.project_id||null;if(lr.length&&!b.project_id)throw new Error('الروابط تحتاج مشروعًا — اختر مشروعًا للمهمة.');if(files?.length&&!b.project_id)throw new Error('الملفات تحتاج مشروعًا — اختر مشروعًا أو ازل الملف.');b.due_date=b.due_date||null;b.description=b.description||null;
   if(id){b.progress=b.status==='completed'?100:Math.min(100,+b.progress||0);await tbl('tasks').set(id,b)}else{const r=await tbl('tasks').add({...b,status:'todo',progress:0,created_by:state.user.id});for(const f of files||[])await upload(f,{project_id:r.project_id,task_id:r.id});id=r.id}
   await saveLinks(lr,{project_id:b.project_id,task_id:id});await log(b.project_id,id,id?'task_updated':'task_created',b.title)}})}
export const act={
 't-open':({id})=>details(id),'tf-set':({k,value})=>{F()[k]=value;saveF();app.render()},'tf-t':({k,v})=>{const f=F();if(k==='quick')f.quick=f.quick===v?'':v;else f[k]=f[k].includes(v)?f[k].filter(x=>x!==v):[...f[k],v];saveF();app.render()},'tf-clear':()=>{state.f.tk={...DEF,sort:F().sort};saveF();app.render()},'tf-open':()=>{state.f.tkOpen=state.f.tkOpen===false;app.render()},'t-new-p':({id})=>tform(null,{project_id:id}),'tv':({v})=>{state.f.tv=v;app.render()},
 't-prog':async({id,value})=>{const x=byId(state.tasks,id),p=+value,status=p>=100?'completed':(p>0&&x.status==='todo')||(p<100&&x.status==='completed')?'in_progress':x.status;await run(async()=>{await tbl('tasks').set(id,{progress:p,status});if(status!==x.status)await log(x.project_id,id,'task_status_changed',`${x.title}: ${status}`)});await app.reload();details(id)},'t-new':()=>tform(),'t-edit':({id})=>tform(id),'f-up-t':({id})=>{const x=byId(state.tasks,id);if(!x.project_id)return toast('المهمة العامة لا تقبل ملفات — اربطها بمشروع أولًا.','error');upForm({project_id:x.project_id,task_id:id})},
 't-next':async({id,re})=>{await setStatus(id,NEXT[byId(state.tasks,id).status]);re&&details(id)},
 't-del':async({id})=>{if(await confirmBox())await run(()=>delTask(id),'تم الحذف.')&&(app.close(),app.reload())},
 't-comment':async({id})=>{const v=$('#c-in').value.trim(),x=byId(state.tasks,id);if(v&&await run(()=>log(x.project_id,id,'comment',v)))await app.reload(),details(id)},
 csv:()=>{const r=[['title','project','assignee','status','priority','progress','due'],...filtered().map(x=>[x.title,projectName(x.project_id),nameOf(x.assigned_to),x.status,x.priority,x.progress,x.due_date||''])];
  const b=new Blob(['\ufeff'+r.map(a=>a.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='tasks.csv';a.click()}
};
export function bindDnd(){let id;document.querySelectorAll('.tk[draggable=true]').forEach(c=>{c.ondragstart=()=>id=c.dataset.id});
  document.querySelectorAll('[data-drop]').forEach(c=>{c.ondragover=e=>{e.preventDefault();c.classList.add('over')};c.ondragleave=()=>c.classList.remove('over');c.ondrop=e=>{e.preventDefault();c.classList.remove('over');id&&setStatus(id,c.dataset.drop)}})}
