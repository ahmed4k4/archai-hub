import {state,isAdmin,byId,nameOf,projectName,visibleFiles,visibleResources,canEditRes,canAddLink} from '../lib/store.js';
import {esc,fmtSize,fmtDate,$} from '../lib/utils.js';
import {STORAGE_LIMIT} from '../config.js';
import {t} from '../lib/i18n.js';
import {empty,form,confirmBox,run,openModal,head,app,toast} from '../ui/ui.js';
import {tbl,upload,removeFile,signedUrl,log,usedBytes,addResources} from '../services/api.js';
export const fileRow=f=>`<div class="file"><i class="fa-regular fa-file-pdf pdf-i"></i><div class="fi"><b class="wrap">${esc(f.file_name)}</b><small>${fmtSize(f.file_size)} • ${fmtDate(f.created_at)} • ${esc(nameOf(f.uploaded_by))}${f.task_id?' • '+esc(byId(state.tasks,f.task_id)?.title||''):''}</small></div><span class="actions"><button class="btn sm" data-a="pdf" data-id="${esc(f.id)}">${t('معاينة')}</button><button class="icon" title="${t('تحميل')}" data-a="f-dl" data-id="${esc(f.id)}"><i class="fa-solid fa-download"></i></button>${isAdmin()?`<button class="icon" data-a="f-edit" data-id="${esc(f.id)}"><i class="fa-solid fa-pen"></i></button><button class="icon" data-a="f-del" data-id="${esc(f.id)}"><i class="fa-solid fa-trash"></i></button>`:''}</span></div>`;
export function render(){
  const rs=visibleResources(),fs=visibleFiles(),g={};fs.forEach(f=>(g[f.project_id||'general']??=[]).push(f));
  const isLink=r=>r.type==='link'||/^https?:\/\//i.test(r.content||'');
  return `<div class="head"><p class="muted">${t('الروابط والملاحظات')} • ${t('ملفات PDF')}</p><span class="actions"><button class="btn" data-a="r-new"><i class="fa-solid fa-plus"></i> ${t('إضافة مورد')}</button>${isAdmin()?`<button class="btn primary" data-a="f-up"><i class="fa-solid fa-cloud-arrow-up"></i> ${t('رفع PDF')}</button>`:''}</span></div>
  <div class="stats"><div class="card stat"><b>${rs.filter(isLink).length}</b><span>${t('رابط')}</span></div><div class="card stat"><b>${rs.filter(r=>!isLink(r)).length}</b><span>${t('ملاحظة')}</span></div><div class="card stat acc"><b>${fs.length}</b><span>${t('ملفات PDF')}</span></div>${isAdmin()?`<div class="card stat"><b>${fmtSize(usedBytes())}</b><span>${t('المساحة المستخدمة')} / 1 GB</span><div class="bar"><i style="width:${Math.min(100,usedBytes()/STORAGE_LIMIT*100)}%"></i></div></div>`:''}</div>
  <div class="split"><div class="card"><h3>${t('الروابط والملاحظات')}</h3>${rs.length?rs.map(r=>linkRow(r,true)).join(''):empty('fa-link-slash')}</div>
  <div>${Object.keys(g).length?Object.entries(g).map(([k,l])=>`<div class="card gap"><h3>${k==='general'?t('ملفات عامة'):esc(projectName(k))}</h3>${l.map(fileRow).join('')}</div>`).join(''):`<div class="card">${empty('fa-folder-open')}</div>`}</div></div>`;
}
const pOpts=()=>visibleProjects().map(p=>[p.id,p.title]);
export const safeHref=u=>{try{const x=new URL(/^[a-z][a-z0-9+.-]*:/i.test(u)?u:'https://'+u);return /^https?:$/.test(x.protocol)?x.href:null}catch{return null}};
/* سطر لكل رابط: "عنوان | رابط" أو الرابط وحده */
export function parseLinks(text){const L=(text||'').split('\n').map(l=>l.trim()).filter(Boolean);if(L.length>10)throw new Error('الحد الأقصى 10 روابط في المرة.');
  return L.map(l=>{const i=l.indexOf('|'),hasT=i>0&&!/^https?:/i.test(l),href=safeHref((hasT?l.slice(i+1):l).trim());if(!href)throw new Error('رابط غير صحيح: '+l.slice(0,60));
    return{title:(hasT?l.slice(0,i).trim():'')||new URL(href).hostname.replace(/^www\./,''),content:href}})}
export const saveLinks=(list,{project_id,task_id})=>addResources(list.map(l=>({project_id,type:'link',title:l.title,content:l.content,created_by:state.user.id,target_user_id:null,...(task_id?{task_id}:{})})));
const asLink=r=>r.type==='link'||/^https?:\/\//i.test(r.content||'');
export const linkRow=(r,ctx)=>{const href=asLink(r)?safeHref(r.content):null,host=href?new URL(href).hostname.replace(/^www\./,''):'';
  return `<div class="lnk"><i class="fa-solid ${href?'fa-link':'fa-note-sticky'} lk-i"></i><div class="fi"><b class="wrap">${esc(r.title)}</b>${ctx?`<small>${esc(projectName(r.project_id))}${r.task_id?' • '+esc(byId(state.tasks,r.task_id)?.title||''):''}</small>`:''}${href?`<a class="wrap" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a>`:`<p class="muted wrap">${esc(r.content)}</p>`}<small class="by"><i class="avatar xs">${esc((r.created_by?nameOf(r.created_by):'?')[0])}</i> ${t('أضافه')}: <b>${r.created_by?esc(nameOf(r.created_by)):'—'}</b>${r.created_by===state.user.id?` <span class="badge on">${t('أنت')}</span>`:''} • ${fmtDate(r.created_at)}</small></div><span class="actions">${href?`<a class="btn sm" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${t('فتح')}</a><button class="icon" title="${t('نسخ')}" data-a="r-copy" data-id="${esc(r.id)}"><i class="fa-regular fa-copy"></i></button>`:''}${canEditRes(r)?`<button class="icon" data-a="r-edit" data-id="${esc(r.id)}"><i class="fa-solid fa-pen"></i></button><button class="icon" data-a="r-del" data-id="${esc(r.id)}"><i class="fa-solid fa-trash"></i></button>`:''}</span></div>`};
function resForm(id,pre={}){const r=id?byId(state.resources,id):pre,me=state.user.id;if(id&&!canEditRes(r))return toast(t('لا تملك صلاحية تعديل هذا الرابط.'),'error');
  form({title:id?'تعديل':'إضافة مورد',init:{type:'link',...r},fields:[{k:'project_id',l:'المشروع',t:'select',o:state.projects.filter(p=>canAddLink({project_id:p.id})||p.id===r.project_id).map(p=>[p.id,p.title]),req:1},{k:'task_id',l:'المهمة (اختياري)',t:'select',o:[['','— على مستوى المشروع —'],...state.tasks.filter(x=>x.project_id&&(isAdmin()||x.assigned_to===me||x.id===r.task_id)).map(x=>[x.id,x.title])]},{k:'type',l:'النوع',t:'select',o:[['link','رابط'],['note','ملاحظة']]},{k:'title',l:'العنوان',req:1},{k:'content',l:'الرابط أو الملاحظة',t:'textarea',req:1}],
  onSubmit:async v=>{
    if(v.task_id&&byId(state.tasks,v.task_id)?.project_id!==v.project_id)throw new Error('المهمة لا تتبع هذا المشروع');
    if(!canAddLink({project_id:v.project_id,task_id:v.task_id||null}))throw new Error(t('لا تملك صلاحية الإضافة هنا.'));
    if(v.type==='link'){const h=safeHref(v.content);if(!h)throw new Error('الرابط غير صحيح');v.content=h}
    const body={project_id:v.project_id,type:v.type,title:v.title,content:v.content};
    if(v.task_id||(id&&'task_id' in r))body.task_id=v.task_id||null;
    try{if(id)await tbl('resources').set(id,body);else await tbl('resources').add({...body,created_by:state.user.id,target_user_id:null})}
    catch(e){if(/task_id/.test(e.message||''))throw new Error('نفّذ ملف supabase/links.sql مرة واحدة لتفعيل روابط المهام.');throw e}
    await log(v.project_id,v.task_id||null,id?'resource_updated':'resource_created',v.title)}})}
export const upForm=(init={})=>form({title:'رفع PDF',submit:'رفع PDF',init,fields:[{k:'project_id',l:'المشروع',t:'select',o:pOpts(),req:1},{k:'task_id',l:'المهمة',t:'select',o:[['','—'],...state.tasks.filter(x=>x.project_id).map(x=>[x.id,x.title])]},{k:'files',l:'اختر ملف PDF (حتى 10MB)',t:'file',acc:'application/pdf',multi:1,req:1}],
  onSubmit:async v=>{if(!v.files.length)throw new Error('اختر ملفًا');if(v.task_id&&byId(state.tasks,v.task_id)?.project_id!==v.project_id)throw new Error('المهمة لا تتبع هذا المشروع');for(const f of v.files)await upload(f,{project_id:v.project_id,task_id:v.task_id||null});await log(v.project_id,v.task_id,'file_uploaded',v.files.map(f=>f.name).join(', '))}});
export const act={
 'r-new':()=>resForm(),'r-new-p':({id})=>resForm(null,{project_id:id}),'r-new-t':({id})=>{const x=byId(state.tasks,id);if(!x?.project_id)return toast('اربط المهمة بمشروع أولًا لإضافة روابط.','error');if(!canAddLink({project_id:x.project_id,task_id:id}))return toast(t('لا تملك صلاحية الإضافة هنا.'),'error');resForm(null,{project_id:x.project_id,task_id:id})},
 'r-copy':({id})=>navigator.clipboard?.writeText(byId(state.resources,id).content).then(()=>toast(t('تم النسخ.'))).catch(()=>toast('تعذر النسخ','error')),'r-edit':({id})=>resForm(id),'f-up':()=>upForm(),
 'r-del':async({id})=>{if(!canEditRes(byId(state.resources,id)))return toast(t('لا تملك صلاحية تعديل هذا الرابط.'),'error');if(await confirmBox())await run(()=>tbl('resources').del(id),'تم الحذف.')&&app.reload()},
 'f-del':async({id})=>{if(await confirmBox())await run(()=>removeFile(id),'تم الحذف.')&&app.reload()},
 'f-edit':({id})=>form({title:'تعديل',init:{file_name:byId(state.files,id).file_name},fields:[{k:'file_name',l:'الاسم',req:1}],onSubmit:v=>tbl('files').set(id,v)}),
 'f-dl':({id})=>run(async()=>{window.open(await signedUrl(byId(state.files,id).file_path,true),'_blank','noopener')}),
 pdf:({id})=>run(async()=>{const f=byId(state.files,id),u=await signedUrl(f.file_path);openModal(head(f.file_name)+`<iframe class="pdf" src="${esc(u)}"></iframe><p style="margin-top:10px"><a class="btn" href="${esc(u)}" target="_blank" rel="noopener">${t('فتح خارجي')}</a></p>`,true)})
};
