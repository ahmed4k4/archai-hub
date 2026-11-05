import {state,isAdmin,byId} from '../lib/store.js';
import {esc} from '../lib/utils.js';
import {t} from '../lib/i18n.js';
import {empty,badge,form,confirmBox,run,app} from '../ui/ui.js';
import {admin} from '../services/api.js';
export function render(){
  if(!isAdmin())return empty('fa-lock','هذه الصفحة للمدير فقط');
  const q=state.search.trim().toLowerCase(),r=state.f.tr2||'',l=state.team.filter(u=>(!r||u.role===r)&&(!q||`${u.full_name} ${u.email}`.toLowerCase().includes(q)));
  return `<div class="head"><select class="flt" data-f="tr2"><option value="">${t('كل الأدوار')}</option><option value="admin" ${r==='admin'?'selected':''}>${t('مدير')}</option><option value="user" ${r==='user'?'selected':''}>${t('موظف')}</option></select><button class="btn primary" data-a="u-new">+ ${t('إضافة عضو')}</button></div>
  <div class="grid">${l.map(u=>{const k=state.tasks.filter(x=>x.assigned_to===u.id);return `<article class="card"><div class="row nb"><span class="avatar">${esc((u.full_name||u.email||'?')[0])}</span>${badge(u.role==='admin'?'p-high':'st-in_progress',u.role==='admin'?'مدير':'موظف')}</div><h4 style="margin-top:10px">${esc(u.full_name||'—')}</h4><p class="muted">${esc(u.email||'')}</p><small>${t('المهام')}: ${k.length} • ${t('مكتملة')}: ${k.filter(x=>x.status==='completed').length}</small>
   <div class="actions" style="margin-top:12px"><button class="btn sm" data-a="u-edit" data-id="${esc(u.id)}">${t('تعديل')}</button>${u.id!==state.user.id?`<button class="btn sm danger" data-a="u-del" data-id="${esc(u.id)}">${t('حذف')}</button>`:''}</div></article>`}).join('')||empty('fa-users')}</div>`;
}
const R=[['user','موظف'],['admin','مدير']];
function uform(id){const u=id&&byId(state.team,id);
  form({title:id?'تعديل':'إضافة عضو',init:u||{},fields:[{k:'full_name',l:'الاسم',req:1},{k:'email',l:'البريد الإلكتروني',t:'email',req:1},{k:'password',l:'كلمة المرور',t:'password',req:!id,min:8},{k:'role',l:'الدور',t:'select',o:R}],
  onSubmit:async v=>{v.email=v.email.toLowerCase();if(!v.password)delete v.password;
   await admin(id?{action:'update',user_id:id,...v}:{action:'create',...v})}})}
export const act={'u-new':()=>uform(),'u-edit':({id})=>uform(id),
 'u-del':async({id})=>{if(id!==state.user.id&&await confirmBox())await run(()=>admin({action:'delete',user_id:id}),'تم الحذف.')&&app.reload()}};
