import {state,isAdmin,byId,nameOf,visibleProjects,projectProgress,linksOf,canSeeRes,canAddLink} from '../lib/store.js';
import {esc,fmtDate,$,overdue,fmtSize} from '../lib/utils.js';
import {t} from '../lib/i18n.js';
import {bar,empty,badge,form,confirmBox,run,app} from '../ui/ui.js';
import {tbl,syncMembers,upload,log,delProject} from '../services/api.js';
import {fileRow,upForm,linkRow,parseLinks,saveLinks} from './resources.js';
import {taskTable,tform,TS} from './tasks.js';
export const PS=[['planning','تخطيط'],['in_progress','قيد التنفيذ'],['paused','متوقف مؤقتًا'],['completed','مكتمل']];
export const PR=[['low','منخفضة'],['medium','متوسطة'],['high','عالية'],['urgent','عاجلة']];
const lab=(a,k)=>a.find(x=>x[0]===k)?.[1]||k||'-',DAY=864e5;
export const prBadge=k=>badge('p-'+k,lab(PR,k));
function health(p,ts){
  if(p.status==='completed')return ['h-ok','مكتمل'];
  const late=ts.some(overdue),pr=projectProgress(p.id),end=p.due_date&&new Date(p.due_date);
  if(late||(end&&end<new Date()))return ['h-late','متأخر'];
  if(end&&p.start_date){const el=Math.min(100,Math.max(0,(Date.now()-new Date(p.start_date))/(end-new Date(p.start_date))*100));if(pr<el-20)return ['h-risk','في خطر']}
  return ['h-ok','على المسار']}
const hb=(p,ts)=>{const[c,l]=health(p,ts);return badge(c,l)};
const SORT={new:(a,b)=>new Date(b.created_at)-new Date(a.created_at),due:(a,b)=>(a.due_date?new Date(a.due_date):1e15)-(b.due_date?new Date(b.due_date):1e15),prog:(a,b)=>projectProgress(b.id)-projectProgress(a.id),name:(a,b)=>a.title.localeCompare(b.title,'ar')};
export function render(){
  const f=state.f.ps||'',so=state.f.psort||'new',l=visibleProjects().filter(p=>!f||p.status===f).sort(SORT[so]);
  const sel=(k,v,o)=>`<select class="flt" data-f="${k}">${o.map(([a,b])=>`<option value="${a}" ${v===a?'selected':''}>${t(b)}</option>`).join('')}</select>`;
  return `<div class="head"><span class="actions">${sel('ps',f,[['','الكل'],...PS])}${sel('psort',so,[['new','الأحدث'],['due','الأقرب تسليمًا'],['prog','الأعلى تقدمًا'],['name','بالاسم']])}</span>${isAdmin()?`<button class="btn primary" data-a="p-new">+ ${t('مشروع جديد')}</button>`:''}</div>
  <div class="grid">${l.length?l.map(p=>{const ts=state.tasks.filter(x=>x.project_id===p.id),pr=projectProgress(p.id);return `<article class="card item" data-a="p-open" data-id="${esc(p.id)}"><div class="row nb"><span>${badge('st-'+p.status,lab(PS,p.status))} ${hb(p,ts)}</span>${prBadge(p.priority)}</div><h4>${esc(p.title)}</h4><p class="clamp">${esc(p.description||'—')}</p>
   <div class="row nb"><small><i class="fa-solid fa-list-check"></i> ${ts.filter(x=>x.status==='completed').length}/${ts.length}</small><small><i class="fa-solid fa-users"></i> ${state.members.filter(m=>m.project_id===p.id).length}</small><small><i class="fa-regular fa-file-pdf"></i> ${state.files.filter(x=>x.project_id===p.id).length}</small><small><i class="fa-solid fa-link"></i> ${state.resources.filter(r=>r.project_id===p.id&&canSeeRes(r)).length}</small><small>${p.due_date?'<i class="fa-regular fa-calendar"></i> '+fmtDate(p.due_date):''}</small></div>${bar(pr)}<div class="row nb"><small>${t('التقدم %')}</small><b>${pr}%</b></div></article>`}).join(''):empty('fa-diagram-project')}</div>`;
}
const TABS=[['ov','نظرة عامة','fa-gauge'],['ts','المهام','fa-list-check'],['fl','الملفات','fa-folder-open'],['lk','الروابط','fa-link'],['mb','الأعضاء','fa-users'],['ac','النشاط','fa-clock-rotate-left']];
export function workspace(id,tab='ov'){
  const p=byId(state.projects,id);if(!p||!visibleProjects().some(x=>x.id===id))return `<div class="card">${empty('fa-lock','المشروع غير متاح')}<p class="center"><button class="btn" data-a="nav" data-v="projects">${t('رجوع')}</button></p></div>`;
  const ts=state.tasks.filter(x=>x.project_id===id),fs=state.files.filter(x=>x.project_id===id),ms=state.members.filter(m=>m.project_id===id),ac=state.activity.filter(a=>a.project_id===id);
  const n=s=>ts.filter(x=>x.status===s).length,pr=projectProgress(id),late=ts.filter(overdue).length,left=p.due_date?Math.ceil((new Date(p.due_date)-new Date(new Date().toDateString()))/DAY):null;
  const lks=state.resources.filter(r=>r.project_id===id&&canSeeRes(r)),cnt={ts:ts.length,fl:fs.length,lk:lks.length,mb:ms.length,ac:ac.length};
  const K=(i,v,l,c='')=>`<div class="card kpi ${c}"><i class="fa-solid ${i}"></i><div><b>${v}</b><small>${t(l)}</small></div></div>`;
  let body='';
  if(tab==='ov'){
    const open=ts.filter(x=>x.status!=='completed'&&x.due_date).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).slice(0,5);
    const el=p.start_date&&p.due_date?Math.min(100,Math.max(0,Math.round((Date.now()-new Date(p.start_date))/(new Date(p.due_date)-new Date(p.start_date))*100))):null;
    body=`<div class="split"><div>
     <div class="card gap"><h4>${t('الوصف')}</h4><p class="wrap" style="margin-top:8px;line-height:1.9">${esc(p.description||'—')}</p></div>
     <div class="card gap"><h4>${t('جدول المشروع')}</h4><div class="row nb"><small>${fmtDate(p.start_date)}</small><small>${fmtDate(p.due_date)}</small></div>${el===null?'':`<div class="bar tl"><i style="width:${el}%"></i><em style="inset-inline-start:${pr}%"></em></div><div class="row nb"><small>${t('جدول المشروع')}: ${el}%</small><small>${t('التقدم %')}: ${pr}%</small></div>`}</div>
     <div class="card gap"><h4>${t('توزيع المهام')}</h4>${TS.map(([k,l])=>`<div class="row nb"><small>${t(l)}</small><b>${n(k)}</b></div>${bar(ts.length?n(k)/ts.length*100:0)}`).join('')}</div>
     <div class="card"><h4>${t('المواعيد القادمة')}</h4>${open.map(x=>`<div class="row" data-a="t-open" data-id="${esc(x.id)}"><span>${esc(x.title)}<br><small>${esc(nameOf(x.assigned_to))}</small></span><small class="${overdue(x)?'bad-t':''}">${fmtDate(x.due_date)}</small></div>`).join('')||empty('fa-calendar-check')}</div></div>
     <div><div class="card gap"><h4>${t('فريق المشروع')}</h4>${ms.map(m=>{const k=ts.filter(x=>x.assigned_to===m.user_id),d=k.filter(x=>x.status==='completed').length;return `<div class="who row nb"><i class="avatar xs">${esc(nameOf(m.user_id)[0])}</i><span class="grow">${esc(nameOf(m.user_id))}<br>${bar(k.length?d/k.length*100:0)}</span><small>${d}/${k.length}</small></div>`}).join('')||empty('fa-users')}</div>
     <div class="card gap"><h4>${t('أحدث الملفات')}</h4>${fs.slice(0,3).map(fileRow).join('')||empty('fa-file-circle-xmark')}</div>
     <div class="card gap"><h4>${t('الروابط')}</h4>${lks.slice(0,3).map(r=>linkRow(r,true)).join('')||empty('fa-link-slash')}</div>
     <div class="card"><h4>${t('آخر النشاط')}</h4>${ac.slice(0,5).map(a=>`<div class="row"><span><b>${esc(nameOf(a.user_id))}</b><br><small class="wrap">${esc(a.description||a.action)}</small></span><small>${fmtDate(a.created_at,1)}</small></div>`).join('')||empty('fa-clock')}</div></div></div>`;
  }else if(tab==='ts'){
    body=`${isAdmin()?`<div class="head"><span></span><button class="btn primary" data-a="t-new-p" data-id="${esc(id)}">+ ${t('إضافة مهمة')}</button></div>`:''}${TS.map(([k,l])=>{const c=ts.filter(x=>x.status===k);return `<div class="card gap"><h4>${t(l)} <span class="badge">${c.length}</span></h4>${c.length?taskTable(c,false):`<p class="muted" style="padding:10px 0">${t('لا توجد مهام')}</p>`}</div>`}).join('')}`;
  }else if(tab==='fl'){
    const docs=fs.filter(f=>!f.task_id),tg={};fs.filter(f=>f.task_id).forEach(f=>(tg[f.task_id]??=[]).push(f));
    body=`${isAdmin()?`<div class="dz" data-dz="${esc(id)}"><i class="fa-solid fa-cloud-arrow-up"></i> ${t('اسحب ملفات PDF هنا أو اضغط للرفع')}</div>`:''}<div class="card gap"><h4>${t('المستندات')} <span class="badge">${docs.length}</span></h4>${docs.map(fileRow).join('')||empty('fa-file-circle-xmark')}</div>
    ${Object.entries(tg).map(([k,l])=>`<div class="card gap"><h4><i class="fa-solid fa-list-check"></i> ${esc(byId(state.tasks,k)?.title||'—')} <span class="badge">${l.length}</span></h4>${l.map(fileRow).join('')}</div>`).join('')}`;
  }else if(tab==='lk'){
    const pl=linksOf({project_id:id}),tg=[];ts.forEach(x=>{const l=linksOf({task_id:x.id});if(l.length)tg.push([x,l])});
    body=`${canAddLink({project_id:id})?`<div class="head"><span></span><button class="btn primary" data-a="r-new-p" data-id="${esc(id)}">+ ${t('إضافة رابط')}</button></div>`:''}<div class="card gap"><h4>${t('روابط المشروع')} <span class="badge">${pl.length}</span></h4>${pl.map(r=>linkRow(r)).join('')||empty('fa-link-slash')}</div>
    ${tg.map(([x,l])=>`<div class="card gap"><h4><i class="fa-solid fa-list-check"></i> ${esc(x.title)} <span class="badge">${l.length}</span></h4>${l.map(r=>linkRow(r)).join('')}</div>`).join('')}`;
  }else if(tab==='mb'){
    body=`${isAdmin()?`<div class="head"><span></span><button class="btn primary" data-a="m-edit" data-id="${esc(id)}">${t('إدارة الأعضاء')}</button></div>`:''}<div class="grid">${ms.map(m=>{const u=byId(state.team,m.user_id),k=ts.filter(x=>x.assigned_to===m.user_id),d=k.filter(x=>x.status==='completed').length;return `<div class="card"><div class="who row nb"><i class="avatar">${esc(nameOf(m.user_id)[0])}</i><span class="grow"><b>${esc(nameOf(m.user_id))}</b><br><small>${esc(u?.email||'')}</small></span></div>${bar(k.length?d/k.length*100:0)}<div class="row nb"><small>${t('المهام')}</small><b>${d}/${k.length}</b></div></div>`}).join('')||empty('fa-users')}</div>`;
  }else{
    body=`<div class="card"><div class="comment"><textarea id="c-in" rows="2" placeholder="${t('أضف تعليقًا...')}"></textarea><button class="btn primary" data-a="p-comment" data-id="${esc(id)}">${t('إرسال')}</button></div>${ac.map(a=>`<div class="tl-i"><i class="fa-solid ${a.action==='comment'?'fa-comment':'fa-circle-dot'}"></i><div><b>${esc(nameOf(a.user_id))}</b> <small>${fmtDate(a.created_at,1)}</small><p class="wrap">${esc(a.description||a.action)}</p></div></div>`).join('')||empty('fa-clock')}</div>`;
  }
  return `<div class="ws-head card"><button class="btn sm" data-a="nav" data-v="projects"><i class="fa-solid fa-arrow-right flip"></i> ${t('رجوع')}</button>
   <div class="row nb wsh"><div><h2>${esc(p.title)}</h2><div class="actions">${isAdmin()?`<select class="flt" data-ch="p-status" data-id="${esc(id)}">${PS.map(([k,v])=>`<option value="${k}" ${p.status===k?'selected':''}>${t(v)}</option>`).join('')}</select>`:badge('st-'+p.status,lab(PS,p.status))}${hb(p,ts)}${prBadge(p.priority)}<small><i class="fa-regular fa-calendar"></i> ${fmtDate(p.start_date)} → ${fmtDate(p.due_date)}</small></div></div>
   ${isAdmin()?`<span class="actions"><button class="btn" data-a="p-edit" data-id="${esc(id)}"><i class="fa-solid fa-pen"></i> ${t('تعديل')}</button><button class="btn" data-a="f-up-p" data-id="${esc(id)}"><i class="fa-solid fa-cloud-arrow-up"></i> ${t('رفع PDF')}</button><button class="btn danger" data-a="p-del" data-id="${esc(id)}"><i class="fa-solid fa-trash"></i></button></span>`:''}</div>
   <div class="row nb"><small>${t('التقدم %')}</small><b>${pr}%</b></div>${bar(pr)}</div>
  <div class="kpis">${K('fa-list-check',ts.length,'إجمالي المهام')}${K('fa-circle-check',n('completed'),'مكتملة','ok')}${K('fa-triangle-exclamation',late,'متأخرة',late?'bad':'')}${K('fa-users',ms.length,'الأعضاء')}${K('fa-file-pdf',fs.length,'الملفات')}${K('fa-hourglass-half',left===null?'—':left<0?t('متأخر'):left+' '+t('يوم'),'المتبقي',left!==null&&left<0?'bad':'')}</div>
  <div class="tabs">${TABS.map(([k,l,i])=>`<button data-a="nav" data-v="project" data-id="${esc(id)}" data-tab="${k}" class="${k===tab?'on':''}"><i class="fa-solid ${i}"></i> ${t(l)}${cnt[k]!==undefined?` <span class="badge">${cnt[k]}</span>`:''}</button>`).join('')}</div>${body}`;
}
export function bindDz(){document.querySelectorAll('[data-dz]').forEach(z=>{const pid=z.dataset.dz;z.onclick=()=>upForm({project_id:pid});
  z.ondragover=e=>{e.preventDefault();z.classList.add('over')};z.ondragleave=()=>z.classList.remove('over');
  z.ondrop=async e=>{e.preventDefault();z.classList.remove('over');const l=[...e.dataTransfer.files];if(l.length&&await run(async()=>{for(const f of l)await upload(f,{project_id:pid});await log(pid,null,'file_uploaded',l.map(f=>f.name).join(', '))},'تم الحفظ.'))app.reload()}})}
function pform(id){const p=id&&byId(state.projects,id),users=state.team.filter(u=>u.role==='user');
  form({title:id?'تعديل':'مشروع جديد',init:{...(p||{}),member_ids:state.members.filter(m=>m.project_id===id).map(m=>m.user_id)},fields:[{k:'title',l:'الاسم',req:1},{k:'description',l:'الوصف',t:'textarea'},{k:'status',l:'الحالة',t:'select',o:PS},{k:'priority',l:'الأولوية',t:'select',o:PR,def:'medium'},{k:'start_date',l:'البداية',t:'date'},{k:'due_date',l:'التسليم',t:'date'},{k:'member_ids',l:'الأعضاء',t:'checks',o:users.map(u=>[u.id,u.full_name||u.email])},{k:'links',l:'إضافة روابط (اختياري)',t:'textarea',ph:'سطر لكل رابط: عنوان | رابط'},...(id?[]:[{k:'files',l:'اختر ملف PDF (حتى 10MB)',t:'file',acc:'application/pdf',multi:1}])],
  onSubmit:async v=>{const{member_ids,files,links,...b}=v;const lr=parseLinks(links);b.description=b.description||null;b.start_date=b.start_date||null;b.due_date=b.due_date||null;
    if(b.start_date&&b.due_date&&b.due_date<b.start_date)throw new Error('تاريخ التسليم قبل البداية');
    let pid=id;if(id)await tbl('projects').set(id,b);else pid=(await tbl('projects').add({...b,created_by:state.user.id})).id;
    await syncMembers(pid,member_ids);await saveLinks(lr,{project_id:pid});for(const f of files||[])await upload(f,{project_id:pid});await log(pid,null,id?'project_updated':'project_created',b.title)}})}
export const act={
 'p-open':({id})=>app.go('project',id),'p-new':()=>pform(),'p-edit':({id})=>pform(id),'f-up-p':({id})=>upForm({project_id:id}),
 'm-edit':({id})=>form({title:'إدارة الأعضاء',init:{m:state.members.filter(m=>m.project_id===id).map(m=>m.user_id)},fields:[{k:'m',l:'الأعضاء',t:'checks',o:state.team.filter(u=>u.role==='user').map(u=>[u.id,u.full_name||u.email])}],onSubmit:v=>syncMembers(id,v.m)}),
 'p-status':async({id,value})=>{if(await run(async()=>{await tbl('projects').set(id,{status:value});await log(id,null,'project_updated','status: '+value)},'تم الحفظ.'))app.reload()},
 'p-del':async({id})=>{if(await confirmBox('حذف المشروع وكل بياناته؟ الإجراء نهائي.')&&await run(()=>delProject(id),'تم الحذف.')){app.go('projects');app.reload()}},
 'p-comment':async({id})=>{const v=$('#c-in').value.trim();if(v&&await run(()=>log(id,null,'comment',v)))app.reload()}
};
