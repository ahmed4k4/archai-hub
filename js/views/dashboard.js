import {state,visibleProjects,visibleTasks,projectProgress,nameOf} from '../lib/store.js';
import {esc,fmtDate,overdue} from '../lib/utils.js';
import {t} from '../lib/i18n.js';
import {bar,empty,badge} from '../ui/ui.js';
export function render(){
  const ps=visibleProjects(),ts=visibleTasks(),n=s=>ts.filter(x=>x.status===s).length,done=n('completed'),rate=ts.length?Math.round(done/ts.length*100):0,late=ts.filter(overdue);
  const S=(v,l,c='')=>`<div class="card stat ${c}"><b>${v}</b><span>${t(l)}</span></div>`;
  const ids=new Set(ts.map(x=>x.id)),act=state.activity.filter(a=>!a.task_id||ids.has(a.task_id)).slice(0,8);
  return `<div class="stats">${S(ps.length,'المشاريع')}${S(ts.length,'المهام')}${S(done,'مكتملة')}${S(late.length,'متأخرة',late.length?'bad':'')}</div>
  <div class="split"><div class="card"><h3>${t('تقدم المشاريع')}</h3>${ps.length?ps.slice(0,8).map(p=>`<div class="item-s" data-a="p-open" data-id="${esc(p.id)}"><div class="row nb"><span>${esc(p.title)}</span><b>${projectProgress(p.id)}%</b></div>${bar(projectProgress(p.id))}</div>`).join(''):empty('fa-folder-open')}</div>
  <div class="card center"><h3>${t('نسبة الإنجاز')}</h3><div class="ring" style="--p:${rate*3.6}deg"><b>${rate}%</b></div>
   <div class="legend"><span>${t('قيد الانتظار')} <b>${n('todo')}</b></span><span>${t('قيد التنفيذ')} <b>${n('in_progress')}</b></span><span>${t('مكتملة')} <b>${done}</b></span></div></div></div>
  <div class="split gap"><div class="card"><h3>${t('متأخرة')}</h3>${late.length?late.slice(0,6).map(x=>`<div class="row" data-a="t-open" data-id="${esc(x.id)}"><span>${esc(x.title)}<br><small>${esc(nameOf(x.assigned_to))}</small></span><small class="bad-t">${fmtDate(x.due_date)}</small></div>`).join(''):empty('fa-circle-check')}</div>
  <div class="card"><h3>${t('آخر النشاط')}</h3>${act.length?act.map(a=>`<div class="row"><span><b>${esc(nameOf(a.user_id))}</b><br><small>${esc(a.description||a.action)}</small></span><small>${fmtDate(a.created_at,1)}</small></div>`).join(''):empty('fa-clock')}</div></div>`;
}
