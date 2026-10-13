import {state,isAdmin,visibleProjects,visibleTasks,projectProgress,nameOf} from '../lib/store.js';
import {esc,fmtDate,overdue} from '../lib/utils.js';
import {t,L} from '../lib/i18n.js';
import {bar,empty,badge} from '../ui/ui.js';
import {clockCard,liveWidget,pointsCard} from './attendance.js';
import {sched} from '../lib/att.js';
export function render(){
  const adm=isAdmin(),me=state.user,ps=visibleProjects(),ts=visibleTasks(),n=s=>ts.filter(x=>x.status===s).length,done=n('completed'),rate=ts.length?Math.round(done/ts.length*100):0,late=ts.filter(overdue);
  const hr=new Date().getHours(),name=(state.profile.full_name||me.email||'').split(' ')[0],greet=hr<12?'صباح الخير':hr<18?'مساء الخير':'مساء النور';
  const date=new Date().toLocaleDateString(L.lang==='en'?'en-GB':'ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const S=(v,l,c='',i='')=>`<div class="card stat ${c}"><b>${v}</b><span>${t(l)}</span></div>`;
  const hasAtt=state.attReady&&(adm||sched(me.id)),qa=(a,l,i,extra='')=>`<button class="btn ${extra}" data-a="${a}"><i class="fa-solid ${i}"></i> ${t(l)}</button>`;
  const upcoming=ts.filter(x=>x.status!=='completed').sort((a,b)=>(a.due_date?+new Date(a.due_date):1e15)-(b.due_date?+new Date(b.due_date):1e15)).slice(0,6);
  const users=state.team.filter(u=>u.role==='user');
  const work=users.map(u=>{const k=state.tasks.filter(x=>x.assigned_to===u.id),d=k.filter(x=>x.status==='completed').length;return{u,open:k.length-d,late:k.filter(overdue).length,pct:k.length?Math.round(d/k.length*100):0}}).sort((a,b)=>b.open-a.open).slice(0,6);
  const ids=new Set(ts.map(x=>x.id)),act=state.activity.filter(a=>!a.task_id||ids.has(a.task_id)).slice(0,7);
  return `<div class="card hero"><div><h2>${t(greet)}، ${esc(name)}</h2><p class="muted">${date}</p></div><div class="actions">${adm?qa('p-new','مشروع جديد','fa-diagram-project','primary')+qa('t-new','مهمة جديدة','fa-list-check')+qa('u-new','إضافة عضو','fa-user-plus'):qa('nav','لوحة المهام','fa-table-columns','primary').replace('data-a="nav"','data-a="nav" data-v="tasks"')}</div></div>
  ${hasAtt?`<div class="split gap">${adm?liveWidget():clockCard(me.id,true)}${adm?'':pointsCard(me.id)}${adm?`<div class="card center"><h3>${t('نسبة الإنجاز')}</h3><div class="ring" style="--p:${rate*3.6}deg"><b>${rate}%</b></div></div>`:''}</div>`:''}
  <div class="stats">${S(ps.length,'المشاريع')}${S(ts.length,'المهام')}${S(n('in_progress'),'قيد التنفيذ')}${S(done,'مكتملة')}${S(late.length,'متأخرة',late.length?'bad':'')}${hasAtt&&!adm?'':S(rate+'%','نسبة الإنجاز','acc')}</div>
  <div class="split"><div class="card"><h3>${t(adm?'المهام القادمة':'مهامي القادمة')}</h3>${upcoming.length?upcoming.map(x=>`<div class="row" data-a="t-open" data-id="${esc(x.id)}"><span>${esc(x.title)}<br><small>${esc(nameOf(x.assigned_to))}</small></span><span class="actions">${badge('st-'+x.status,x.status==='todo'?'قيد الانتظار':'قيد التنفيذ')}<small class="${overdue(x)?'bad-t':''}">${fmtDate(x.due_date)}</small></span></div>`).join(''):empty('fa-circle-check')}</div>
  <div class="card"><h3>${t('تقدم المشاريع')}</h3>${ps.length?ps.slice(0,6).map(p=>`<div class="item-s" data-a="p-open" data-id="${esc(p.id)}"><div class="row nb"><span>${esc(p.title)}</span><b>${projectProgress(p.id)}%</b></div>${bar(projectProgress(p.id))}</div>`).join(''):empty('fa-folder-open')}</div></div>
  <div class="split gap" style="margin-top:16px">${adm?`<div class="card"><h3>${t('حمل العمل على الفريق')}</h3>${work.map(w=>`<div class="who row nb"><i class="avatar xs">${esc((w.u.full_name||'?')[0])}</i><span class="grow">${esc(w.u.full_name||w.u.email)}<br>${bar(w.pct)}</span><small>${w.open} ${t('مفتوحة')}${w.late?` • <span class="bad-t">${w.late} ${t('متأخرة')}</span>`:''}</small></div>`).join('')||empty('fa-users')}</div>`:`<div class="card"><h3>${t('متأخرة')}</h3>${late.slice(0,5).map(x=>`<div class="row" data-a="t-open" data-id="${esc(x.id)}"><span>${esc(x.title)}</span><small class="bad-t">${fmtDate(x.due_date)}</small></div>`).join('')||empty('fa-circle-check')}</div>`}
  <div class="card"><h3>${t('آخر النشاط')}</h3>${act.length?act.map(a=>`<div class="row"><span><b>${esc(nameOf(a.user_id))}</b><br><small>${esc(a.description||a.action)}</small></span><small>${fmtDate(a.created_at,1)}</small></div>`).join(''):empty('fa-clock')}</div></div>`;
}
