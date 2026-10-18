import {state,isAdmin,byId,nameOf} from '../lib/store.js';
import {esc,fmtDate} from '../lib/utils.js';
import {t} from '../lib/i18n.js';
import {att,loadAtt} from '../services/api.js';
import {form,openModal,head,confirmBox,run,empty,badge,bar,app,toast} from '../ui/ui.js';
import * as A from '../lib/att.js';
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],hmS=v=>v?String(v).slice(0,5):'—';
const emps=()=>state.team.filter(u=>u.role==='user'),monthDays=uid=>(state.wdays||[]).filter(d=>(!uid||d.user_id===uid)&&d.work_date.startsWith(state.attMonth));
const schedText=s=>s.mode==='fixed'?`${hmS(s.start_time)} – ${hmS(s.end_time)}`:`${t('مرن')} • ${A.durS(s.daily_minutes*60)}/${t('يوم')}`;
const wdText=s=>s.work_days.length===7?t('كل الأيام'):[...s.work_days].sort().map(i=>DAYS[i]).join('، ');
const dchip=d=>{const i=A.deltaInfo(d);return i?`<span class="dchip ${i.tone}">${A.dotEl(d.dot)} ${esc(t(i.txt))}</span>`:'—'};
const av=n=>`<i class="avatar xs">${esc((n||'?')[0])}</i>`;
const monthPick=()=>`<input type="month" class="flt" data-ch="att-month" value="${esc(state.attMonth)}" max="${A.today().slice(0,7)}">`;
const tick=(base,since,cap)=>`<b class="tick" data-tick data-base="${Math.floor(base)}" data-since="${since||0}" data-cap="${cap||0}">${A.dur(base+(since?(Math.min(A.nowMs(),cap||Infinity)-since)/1000:0))}</b>`;
const notReady=()=>`<div class="card">${empty('fa-database',isAdmin()?'نظام الحضور غير مفعّل بعد — شغّل supabase/attendance.sql مرة واحدة ثم حدّث الصفحة':'نظام الحضور غير متاح حاليًا')}</div>`;
/* ---------- مسار اليوم: شريط زمني + قائمة الفترات ---------- */
export function pathView(ss,admin){
  if(!ss.length)return `<p class="muted">${t('لم تُسجَّل أي جلسة بعد')}</p>`;
  const now=A.nowMs(),seg=ss.map(x=>{const a=A.minsOfDay(+new Date(x.started_at)),b=x.ended_at?A.minsOfDay(+new Date(x.ended_at)):A.minsOfDay(now);return{a,b:Math.max(a+1,b),x}});
  let lo=Math.max(0,Math.floor((Math.min(...seg.map(s=>s.a))-30)/60)*60),hi=Math.min(1440,Math.ceil((Math.max(...seg.map(s=>s.b))+30)/60)*60);if(hi-lo<240)hi=Math.min(1440,lo+240);if(hi-lo<240)lo=Math.max(0,hi-240);
  const pc=v=>((v-lo)/(hi-lo)*100).toFixed(2),lbl=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:00`;
  return `<div class="dtl" dir="ltr"><div class="dtl-bar">${seg.map(s=>`<span class="tseg ${s.x.ended_at?'':'live'}" style="left:${pc(s.a)}%;width:${Math.max(.8,pc(s.b)-pc(s.a))}%" title="${A.hm(s.x.started_at)} → ${s.x.ended_at?A.hm(s.x.ended_at):'…'}"></span>`).join('')}</div><div class="dtl-t"><small>${lbl(lo)}</small><small>${lbl(Math.round((lo+hi)/120)*60)}</small><small>${lbl(hi)}</small></div></div>
  <div class="segs">${ss.map((x,i)=>`<div class="seg-r"><span class="n">${i+1}</span><div><b>${A.hm(x.started_at)} → ${x.ended_at?A.hm(x.ended_at):`<span class="live-t">${t('جارٍ')}</span>`}</b> <small>${x.ended_at?A.durS((+new Date(x.ended_at)-+new Date(x.started_at))/1000):''}</small>${x.comment?`<p class="wrap">${esc(x.comment)}</p>`:''}</div>${admin?`<span class="actions"><button class="icon" data-a="att-sess-edit" data-id="${esc(x.id)}"><i class="fa-solid fa-pen"></i></button><button class="icon" data-a="att-sess-del" data-id="${esc(x.id)}"><i class="fa-solid fa-trash"></i></button></span>`:''}</div>`).join('')}</div>`;
}
/* ---------- ساعة العمل (للموظف + مصغّرة للداشبورد) ---------- */
export function clockCard(uid,compact){
  const s=A.sched(uid);if(!s)return '';
  const st=A.status(uid),d=A.activeDay(uid),open=A.openOf(uid),ss=d?A.sessOf(d.id):[],base=d?A.baseSec(d):0,since=open?+new Date(open.started_at):0,cap=open&&d?A.capOf(d):0,[lbl,cls]=A.STATUS_LBL[st];
  const nowMin=A.minsOfDay(A.nowMs()),offDay=!s.work_days.includes(A.dowOf(A.today())),worked=base+(since?(Math.min(A.nowMs(),cap||Infinity)-since)/1000:0);let hint='';
  if(s.mode==='fixed'&&!offDay){const a=A.tmin(s.start_time),b=A.tmin(s.end_time);
    hint=st==='idle'?(nowMin<a?`${t('يبدأ دوامك بعد')} ${A.durS((a-nowMin)*60)}`:`<span class="bad-t">${t('تأخرت عن موعدك')} ${A.durS((nowMin-a)*60)}</span>`):st==='working'?(nowMin<b?`${t('متبقي على نهاية الدوام')} ${A.durS((b-nowMin)*60)}`:`${t('تجاوزت نهاية الدوام بـ')} ${A.durS((nowMin-b)*60)}`):''}
  const btn=(a,l,i,c='')=>`<button class="btn ${c}" data-a="${a}"><i class="fa-solid ${i}"></i> ${t(l)}</button>`;
  const acts=st==='done'?`<span class="muted">${t('تم إنهاء اليوم — شكرًا لك')}</span>`:s.mode==='fixed'?(st==='idle'?btn('att-start','بدء العمل','fa-play','primary big'):btn('att-stop','إنهاء العمل','fa-flag-checkered','primary big')):
    st==='working'?btn('att-pause','إيقاف مؤقت','fa-pause','big')+btn('att-finish','إنهاء اليوم','fa-flag-checkered','primary big'):st==='paused'?btn('att-start','استئناف','fa-play','primary big')+btn('att-finish','إنهاء اليوم','fa-flag-checkered','big'):btn('att-start','بدء العمل','fa-play','primary big');
  const tgt=s.mode==='flexible'?s.daily_minutes*60:0;
  return `<div class="card clock ${st}"><div class="clock-h"><span class="badge ${cls}">${t(lbl)}</span><small class="muted"><i class="fa-regular fa-clock"></i> ${schedText(s)} • ${wdText(s)}</small>${offDay?`<span class="badge st-paused">${t('اليوم خارج أيام العمل')}</span>`:''}</div>
  <div class="clock-t">${tick(base,since,cap)}<small>${t('إجمالي وقت العمل اليوم')}</small></div>${tgt?`${bar(Math.min(100,worked/tgt*100))}<div class="row nb"><small>${t('الهدف اليومي')} ${A.durS(tgt)}</small><small>${Math.round(worked/tgt*100)}%</small></div>`:''}
  ${hint?`<p class="center muted">${hint}</p>`:''}${st==='working'||st==='paused'?`<p class="center"><small class="muted"><i class="fa-solid fa-shield-halved"></i> ${s.mode==='fixed'?`${t('يُغلق يومك تلقائيًا ويُحسب بعد نهاية الدوام بـ')} ${state.rules.fixed_grace_minutes??120} ${t('دقيقة')}`:t('يُغلق يومك تلقائيًا عند منتصف الليل ويُحسب')}</small></p>`:''}${d?.dot?`<p class="center">${dchip(d)} ${A.endInfo(d)&&d.closed?`<small class="muted">• ${t(A.endInfo(d))}</small>`:''}</p>`:''}<div class="actions clock-a">${acts}</div>
  ${compact?'':`<h4 style="margin:18px 0 8px">${t('مسار اليوم')}</h4>${pathView(ss)}${d?.summary&&d.closed?`<h4 style="margin:14px 0 6px">${t('ما تم إنجازه')}</h4><p class="box wrap">${esc(d.summary)}</p>`:''}`}</div>`;
}
/* ---------- بطاقة النقاط والإحصاءات ---------- */
export function pointsCard(uid,days=monthDays(uid)){
  const sm=A.summary(uid,days),ex=A.expected(uid,state.attMonth),r=state.rules,K=(v,l,c='')=>`<div class="meta"><small>${t(l)}</small><b class="${c}">${v}</b></div>`;
  return `<div class="card gap"><div class="row nb"><h4><i class="fa-solid fa-medal"></i> ${t('نقاط الالتزام')}</h4><small class="muted">${esc(state.attMonth)}</small></div>
  <div class="dots-row"><div class="dbox red">${A.dotEl('red',1)}<b>${sm.red}</b><small>${t('تأخير')}</small></div><div class="dbox green">${A.dotEl('green',1)}<b>${sm.green}</b><small>${t('تبكير')}</small></div><div class="dbox blue">${A.dotEl('blue',1)}<b>${sm.blue}</b><small>${t('في الموعد')}</small></div></div>
  <p class="net ${sm.net?'bad-t':'ok-t'}">${t('صافي النقاط الحمراء')}: <b>${sm.net}</b> <small class="muted">(${sm.red} − ${sm.off} ← ${sm.green} ${t('خضراء')} ÷ ${sm.gpr})</small></p>
  <div class="metas">${K(A.durS(sm.sec),'ساعات العمل')}${K(ex.minutes?A.durS(ex.minutes*60):'—','الساعات المستهدفة')}${K(ex.absent,'أيام الغياب',ex.absent?'bad-t':'')}${K(sm.late+' د','إجمالي التأخير',sm.late?'bad-t':'')}${K(sm.early+' د','إجمالي التبكير','ok-t')}${K((sm.avg>0?'+':'')+sm.avg+' د','متوسط الفرق عن الموعد')}${K(sm.ot+' د','وقت إضافي')}${K(sm.leftEarly+' د','خروج مبكر')}</div>
  <small class="muted">${t('القواعد')}: ${t('تأخير')} ≥ ${r.late_threshold}د = ${t('حمراء')} • ${t('تبكير')} ≥ ${r.early_threshold}د = ${t('خضراء')} • ${t('غير ذلك')} = ${t('زرقاء')} • ${r.greens_per_red} ${t('خضراء تلغي حمراء')}</small></div>`;
}
const histRows=(days,showName)=>days.length?`<div class="tbl"><div class="atr th"><span>${t('التاريخ')}</span><span>${t(showName?'الموظف':'الحضور')}</span><span>${t('الفرق')}</span><span>${t('الانصراف')}</span><span>${t('المدة')}</span><span>${t('نقطة')}</span><span>${t('ما تم إنجازه')}</span></div>${days.map(d=>`<div class="atr" data-a="att-day" data-id="${esc(d.id)}"><span><b>${esc(DAYS[A.dowOf(d.work_date)])}</b><br><small>${fmtDate(d.work_date)}</small></span><span>${showName?`<span class="who">${av(nameOf(d.user_id))}${esc(nameOf(d.user_id))}</span><small>${A.hm(d.first_start)}</small>`:A.hm(d.first_start)}</span><span>${dchip(d)}</span><span>${d.closed?A.hm(d.last_end):'<small class="live-t">'+t('مفتوح')+'</small>'}${d.auto_closed?`<br><small class="bad-t">${t('أُغلق تلقائيًا')}</small>`:''}</span><span><b>${A.durS(A.workedSec(d))}</b></span><span>${A.dotEl(d.dot)}</span><span class="wrap muted clamp">${esc(d.summary||'')}</span></div>`).join('')}</div>`:empty('fa-calendar-xmark','لا توجد سجلات في هذا الشهر');
/* ---------- واجهة الموظف ---------- */
function employeeView(uid){
  if(!A.sched(uid))return `<div class="card">${empty('fa-clock','لم يحدد المدير جدول عمل لك بعد')}</div>`;
  return `${clockCard(uid)}${pointsCard(uid)}<div class="card"><div class="row nb"><h4>${t('سجل الحضور')}</h4>${monthPick()}</div>${histRows(monthDays(uid))}</div>`;
}
/* ---------- واجهة المدير ---------- */
export function liveRows(){
  const td=A.today(),dow=A.dowOf(td),nowMin=A.minsOfDay(A.nowMs()),thr=state.rules.late_threshold;
  return (state.wsched||[]).filter(s=>s.active).map(s=>{const uid=s.user_id,st=A.status(uid),d=A.activeDay(uid),off=!s.work_days.includes(dow);
    const late=s.mode==='fixed'&&!off&&st==='idle'&&nowMin>=A.tmin(s.start_time)+thr?nowMin-A.tmin(s.start_time):0;return{s,uid,st,d,off,late}});
}
export function liveWidget(){
  const L=liveRows();if(!L.length)return `<div class="card">${empty('fa-clock','لم يتم تحديد جداول عمل بعد')}</div>`;
  const w=L.filter(x=>x.st==='working'),late=L.filter(x=>x.late);
  return `<div class="card"><div class="row nb"><h4><i class="fa-solid fa-tower-broadcast"></i> ${t('الحضور الآن')}</h4><button class="btn sm" data-a="nav" data-v="attendance">${t('فتح')}</button></div>
  <div class="live-k"><div><b class="ok-t">${w.length}</b><small>${t('يعمل الآن')}</small></div><div><b>${L.filter(x=>x.st==='done').length}</b><small>${t('أنهى اليوم')}</small></div><div><b class="${late.length?'bad-t':''}">${late.length}</b><small>${t('متأخر عن البدء')}</small></div><div><b>${L.filter(x=>x.st==='idle'&&!x.late&&!x.off).length}</b><small>${t('لم يبدأ')}</small></div></div>
  ${w.slice(0,5).map(x=>`<div class="row"><span class="who">${av(nameOf(x.uid))}${esc(nameOf(x.uid))}</span>${tick(A.baseSec(x.d),+new Date(A.openOf(x.uid).started_at),A.capOf(x.d))}</div>`).join('')}${late.slice(0,3).map(x=>`<div class="row"><span class="who">${av(nameOf(x.uid))}${esc(nameOf(x.uid))}</span><span class="dchip bad">${t('لم يحضر')} • ${A.durS(x.late*60)}</span></div>`).join('')}</div>`;
}
function liveTab(){
  const L=liveRows(),td=A.today(),stale=(state.wdays||[]).filter(d=>!d.closed&&d.work_date<td),tot=L.reduce((a,x)=>a+(x.d?A.workedSec(x.d):0),0);
  const K=(v,l,c='')=>`<div class="card kpi"><div><b class="${c}">${v}</b><small>${t(l)}</small></div></div>`;
  return `<div class="kpis">${K(L.filter(x=>!x.off).length,'مجدولون اليوم')}${K(L.filter(x=>x.st==='working').length,'يعملون الآن','ok-t')}${K(L.filter(x=>x.st==='done').length,'أنهوا اليوم')}${K(L.filter(x=>x.late).length,'متأخرون عن البدء','bad-t')}${K(A.durS(tot),'إجمالي ساعات اليوم')}</div>
  ${stale.length?`<div class="card gap warn"><b><i class="fa-solid fa-triangle-exclamation"></i> ${t('أيام لم يُنهِها أصحابها')}: ${stale.map(d=>esc(nameOf(d.user_id))).join('، ')}</b></div>`:''}
  <div class="card">${L.length?`<div class="tbl"><div class="atr live th"><span>${t('الموظف')}</span><span>${t('الجدول')}</span><span>${t('الحالة')}</span><span>${t('الحضور')}</span><span>${t('الفرق')}</span><span>${t('وقت اليوم')}</span><span></span></div>${L.map(({s,uid,st,d,off,late})=>`<div class="atr live" ${d?`data-a="att-day" data-id="${esc(d.id)}"`:''}><span class="who">${av(nameOf(uid))}<b>${esc(nameOf(uid))}</b></span><span>${schedText(s)}</span><span>${off&&!d?`<span class="badge">${t('خارج أيام العمل')}</span>`:badge(A.STATUS_LBL[st][1],A.STATUS_LBL[st][0])}${late?`<br><small class="bad-t">${t('متأخر')} ${A.durS(late*60)}</small>`:''}</span><span>${A.hm(d?.first_start)}</span><span>${d?dchip(d):'—'}</span><span>${tick(d?A.baseSec(d):0,A.openOf(uid)?+new Date(A.openOf(uid).started_at):0,A.openOf(uid)&&d?A.capOf(d):0)}</span><span>${st==='working'||st==='paused'?`<button class="btn sm danger" data-a="att-admin-stop" data-id="${esc(uid)}"><i class="fa-solid fa-stop"></i> ${t('إيقاف')}</button>`:''}</span></div>`).join('')}</div>`:empty('fa-user-clock','لم تحدد جداول عمل بعد — افتح تبويب الجداول')}</div>`;
}
const sumRows=()=>(state.wsched||[]).filter(s=>s.active).map(s=>{const days=monthDays(s.user_id),sm=A.summary(s.user_id,days),ex=A.expected(s.user_id,state.attMonth);return{s,uid:s.user_id,sm,ex}});
function summaryTab(){const R=sumRows();
  return `<div class="head">${monthPick()}<button class="btn" data-a="att-csv"><i class="fa-solid fa-download"></i> ${t('تصدير CSV')}</button></div><div class="card">${R.length?`<div class="tbl"><div class="atr sum th"><span>${t('الموظف')}</span><span>${t('أيام')}</span><span>${t('غياب')}</span><span>${t('الساعات')}</span><span>${A.dotEl('red')}</span><span>${A.dotEl('green')}</span><span>${A.dotEl('blue')}</span><span>${t('الصافي')}</span><span>${t('متوسط الفرق')}</span></div>${R.map(({uid,sm,ex})=>`<div class="atr sum" data-a="att-emp" data-id="${esc(uid)}"><span class="who">${av(nameOf(uid))}<b>${esc(nameOf(uid))}</b></span><span>${sm.days}</span><span class="${ex.absent?'bad-t':''}">${ex.absent}</span><span>${A.durS(sm.sec)}<br><small>/ ${ex.minutes?A.durS(ex.minutes*60):'—'}</small></span><span><b>${sm.red}</b></span><span><b>${sm.green}</b></span><span><b>${sm.blue}</b></span><span><b class="${sm.net?'bad-t':'ok-t'}">${sm.net}</b></span><span>${sm.avg>0?'+':''}${sm.avg} د</span></div>`).join('')}</div>`:empty('fa-chart-simple','لا توجد بيانات')}</div>
  <p class="muted" style="margin-top:10px"><small>${t('الصافي')} = ${t('الحمراء')} − ⌊${t('الخضراء')} ÷ ${state.rules.greens_per_red}⌋</small></p>`}
function recordsTab(){const f=state.f.attEmp||'',days=monthDays(f);
  return `<div class="head"><span class="actions">${monthPick()}<select class="flt" data-ch="att-emp-f"><option value="">${t('كل الموظفين')}</option>${emps().map(u=>`<option value="${esc(u.id)}" ${f===u.id?'selected':''}>${esc(u.full_name||u.email)}</option>`).join('')}</select></span></div><div class="card">${histRows(days,true)}</div>`}
function schedulesTab(){
  return `<div class="grid">${emps().map(u=>{const s=(state.wsched||[]).find(x=>x.user_id===u.id);return `<div class="card"><div class="row nb"><span class="who">${av(u.full_name)}<b>${esc(u.full_name||u.email)}</b></span>${s?badge(s.active?'st-in_progress':'st-paused',s.active?'نشط':'موقوف'):badge('','بدون جدول')}</div>
   ${s?`<p style="margin:10px 0 4px"><i class="fa-regular fa-clock"></i> <b>${schedText(s)}</b></p><small class="muted">${s.mode==='fixed'?t('دوام ثابت'):t('فترة مرنة')} • ${wdText(s)}</small>`:`<p class="muted" style="margin:10px 0">${t('لم يتم تحديد مواعيد عمل')}</p>`}
   <div class="actions" style="margin-top:12px"><button class="btn sm primary" data-a="att-sched" data-id="${esc(u.id)}">${t(s?'تعديل':'تعيين جدول')}</button>${s?`<button class="btn sm danger" data-a="att-delsched" data-id="${esc(u.id)}">${t('حذف')}</button>`:''}</div></div>`}).join('')||empty('fa-users')}</div>`}
function rulesTab(){const r=state.rules,rw=(i,ti,tx)=>`<div class="rule"><span>${i}</span><div><b>${t(ti)}</b><p class="muted">${tx}</p></div></div>`,ic=c=>`<i class="fa-solid ${c}" style="color:var(--acc)"></i>`;
  return `<div class="card gap"><div class="row nb"><h4><i class="fa-solid fa-scale-balanced"></i> ${t('قواعد النقاط')}</h4><button class="btn primary" data-a="att-rules">${t('تعديل القواعد')}</button></div>
  ${rw(A.dotEl('red',1),'نقطة حمراء',`${t('عند الحضور متأخرًا')} <b>${r.late_threshold}</b> ${t('دقائق أو أكثر عن موعد الدوام (أو نقص عن الهدف اليومي في الفترة المرنة)')}`)}
  ${rw(A.dotEl('green',1),'نقطة خضراء',`${t('عند الحضور مبكرًا')} <b>${r.early_threshold}</b> ${t('دقائق أو أكثر (أو زيادة عن الهدف اليومي في الفترة المرنة)')}`)}
  ${rw(A.dotEl('blue',1),'نقطة زرقاء',t('الحضور في الموعد ضمن الفارق المسموح'))}
  ${rw(ic('fa-equals'),'التعويض',`<b>${r.greens_per_red}</b> ${t('نقاط خضراء تلغي نقطة حمراء واحدة عند حساب الصافي')}`)}
  ${rw(ic('fa-user-slash'),'الغياب',r.absent_is_red===false?t('الغياب لا يُحتسب نقطة'):t('يوم عمل مجدول بدون أي حضور = نقطة حمراء تلقائيًا (آخر 7 أيام، ولا يشمل العطلات)'))}
  ${rw(ic('fa-moon'),'الإغلاق التلقائي',`${t('يُغلق اليوم المفتوح تلقائيًا عند منتصف الليل، وفي الدوام الثابت بعد نهاية الدوام بـ')} <b>${r.fixed_grace_minutes??120}</b> ${t('دقيقة، ويُحسب بالنقاط تلقائيًا')}`)}
  ${rw(ic('fa-hourglass-start'),'أقصى تبكير للبدء',`${t('لا يمكن بدء الدوام الثابت قبل موعده بأكثر من')} <b>${r.early_window_minutes??120}</b> ${t('دقيقة')}`)}
  ${rw(ic('fa-globe'),'المنطقة الزمنية',`${esc(r.tz)} • ${t('كل الأوقات تُسجَّل من وقت السيرفر')}`)}</div>
  <div class="card"><div class="row nb"><h4><i class="fa-solid fa-umbrella-beach"></i> ${t('العطلات الرسمية')}</h4><button class="btn primary" data-a="att-holi-add">+ ${t('إضافة عطلة')}</button></div>
  <p class="muted"><small>${t('في أيام العطلة لا يُحتسب غياب ولا تأخير')}</small></p>
  ${(state.wholi||[]).slice().sort((a,b)=>b.day.localeCompare(a.day)).map(h=>`<div class="row"><span><b>${fmtDate(h.day)}</b> <small class="muted">${esc(DAYS[A.dowOf(h.day)])}</small>${h.note?` — ${esc(h.note)}`:''}</span><button class="icon" data-a="att-holi-del" data-id="${esc(h.day)}"><i class="fa-solid fa-trash"></i></button></div>`).join('')||empty('fa-calendar-day','لا توجد عطلات مسجلة')}</div>`}
function adminView(){
  const tab=state.f.attTab||'live',T=[['live','الآن','fa-tower-broadcast'],['summary','ملخص الشهر','fa-chart-simple'],['records','السجلات','fa-table-list'],['schedules','الجداول','fa-calendar-days'],['rules','القواعد','fa-scale-balanced']];
  return `<div class="tabs">${T.map(([k,l,i])=>`<button data-a="att-tab" data-v="${k}" class="${k===tab?'on':''}"><i class="fa-solid ${i}"></i> ${t(l)}</button>`).join('')}</div>${{live:liveTab,summary:summaryTab,records:recordsTab,schedules:schedulesTab,rules:rulesTab}[tab]()}`;
}
export const render=()=>!state.attReady?notReady():isAdmin()?adminView():employeeView(state.user.id);
/* ---------- تفاصيل يوم ---------- */
function dayModal(id){const d=byId(state.wdays,id);if(!d)return;const ss=A.sessOf(d.id),M=(l,v)=>`<div class="meta"><small>${t(l)}</small><b>${v}</b></div>`;
  openModal(head(`${nameOf(d.user_id)} — ${DAYS[A.dowOf(d.work_date)]} ${fmtDate(d.work_date)}`)+`<div class="metas">${M('الحضور',A.hm(d.first_start))}${M('الانصراف',d.closed?A.hm(d.last_end):t('مفتوح'))}${M('إجمالي الوقت',A.durS(A.workedSec(d)))}${M('الفرق',dchip(d))}${A.endInfo(d)?M('وقت الانصراف',esc(t(A.endInfo(d)))):''}${d.sched_start?M('الموعد',`${hmS(d.sched_start)} – ${hmS(d.sched_end)}`):d.target_minutes?M('الهدف',A.durS(d.target_minutes*60)):''}</div>
  <h4>${t('مسار اليوم')}</h4>${pathView(ss,isAdmin())}${d.summary?`<h4 style="margin-top:14px">${t('ما تم إنجازه')}</h4><p class="box wrap">${esc(d.summary)}</p>`:''}${d.dot_note?`<p class="box wrap"><b>${t('ملاحظة المدير')}:</b> ${esc(d.dot_note)}</p>`:''}${d.auto_closed?`<p class="bad-t">${t('أُغلق هذا اليوم تلقائيًا — راجع الوقت المسجَّل')}</p>`:''}
  ${isAdmin()?`<div class="actions" style="margin-top:14px">${!d.closed&&A.openOf(d.user_id)?`<button class="btn danger" data-a="att-admin-stop" data-id="${esc(d.user_id)}"><i class="fa-solid fa-stop"></i> ${t('إيقاف المؤقت')}</button>`:''}${d.absent?'':`<button class="btn" data-a="att-sess-add" data-id="${esc(id)}"><i class="fa-solid fa-plus"></i> ${t('إضافة فترة')}</button>`}<button class="btn" data-a="att-recalc" data-id="${esc(id)}"><i class="fa-solid fa-rotate"></i> ${t('إعادة الحساب')}</button><button class="btn" data-a="att-dot" data-id="${esc(id)}">${t('تعديل النقطة')}</button>${d.absent?`<button class="btn primary" data-a="att-excuse" data-id="${esc(id)}">${t('إعفاء من الغياب')}</button>`:''}${d.closed&&!d.absent&&d.work_date===A.today()?`<button class="btn" data-a="att-reopen" data-id="${esc(id)}">${t('إعادة فتح اليوم')}</button>`:''}${d.absent?'':`<button class="btn danger" data-a="att-delday" data-id="${esc(id)}">${t('حذف السجل')}</button>`}</div>`:''}`,true)}
const guard=fn=>async v=>{try{return await fn(v)}catch(e){await app.reload();throw e}};   // عند الفشل نُحدّث الشاشة لتطابق السيرفر
const after=m=>async()=>{app.close();await app.reload();m&&toast(t(m))};
const ok=(fn,msg)=>run(fn,msg);
const startMsg=d=>d.mode==='fixed'&&d.start_delta!=null?(d.dot==='red'?`تم تسجيل الحضور — متأخر ${d.start_delta} د`:d.dot==='green'?`تم تسجيل الحضور — بكّرت ${-d.start_delta} د`:'تم تسجيل الحضور في الموعد'):'تم بدء العمل';
export const act={
 'att-tab':({v})=>{state.f.attTab=v;app.render()},
 'att-month':async({value})=>{if(value&&await run(()=>loadAtt(value)))app.render()},
 'att-emp-f':({value})=>{state.f.attEmp=value;app.render()},
 'att-emp':({id})=>{state.f.attEmp=id;state.f.attTab='records';app.render()},
 'att-day':({id})=>dayModal(id),
 'att-start':async()=>{let d;if(await run(async()=>{d=await att.start()}))toast(t(startMsg(d)));await app.reload()},
 'att-stop':()=>form({title:'إنهاء العمل',submit:'تسجيل الانصراف',fields:[{k:'c',l:'ما الذي تم إنجازه اليوم؟',t:'textarea',req:1,ph:'اكتب ملخصًا بما أنجزته'}],onSubmit:guard(v=>att.stop(v.c,true))}),
 'att-pause':()=>form({title:'إيقاف مؤقت',submit:'إيقاف',fields:[{k:'c',l:'ما الذي أنجزته في هذه الفترة؟ (اختياري)',t:'textarea'}],onSubmit:guard(v=>att.stop(v.c,false))}),
 'att-finish':()=>form({title:'إنهاء اليوم',submit:'إنهاء اليوم',fields:[{k:'c',l:'ما الذي تم إنجازه اليوم؟',t:'textarea',req:1,ph:'اكتب ملخصًا بما أنجزته'}],onSubmit:guard(v=>att.stop(v.c,true))}),
 'att-sched':({id})=>{const s=(state.wsched||[]).find(x=>x.user_id===id),u=byId(state.team,id);
   form({title:'جدول العمل',init:{mode:s?.mode||'fixed',start_time:hmS(s?.start_time)==='—'?'09:00':hmS(s?.start_time),end_time:hmS(s?.end_time)==='—'?'17:00':hmS(s?.end_time),hours:s?.daily_minutes?s.daily_minutes/60:6,work_days:(s?.work_days||[0,1,2,3,4]).map(String),active:s?(s.active?'1':'0'):'1'},
   fields:[{k:'mode',l:'نوع الدوام',t:'select',o:[['fixed','دوام ثابت (حضور وانصراف في مواعيد محددة)'],['flexible','فترة مرنة (ساعات يومية يقسمها الموظف)']]},{k:'start_time',l:'بداية الدوام (للدوام الثابت)',t:'time'},{k:'end_time',l:'نهاية الدوام (للدوام الثابت)',t:'time'},{k:'hours',l:'الساعات اليومية (للفترة المرنة)',t:'number',mn:0.25,mx:16,step:0.25},{k:'work_days',l:'أيام العمل',t:'checks',o:DAYS.map((d,i)=>[String(i),d])},{k:'active',l:'الحالة',t:'select',o:[['1','نشط'],['0','موقوف']]}],
   onSubmit:async v=>{const days=v.work_days.map(Number).sort();if(!days.length)throw new Error('اختر يومًا واحدًا على الأقل');
     const row={user_id:id,mode:v.mode,work_days:days,active:v.active==='1',updated_at:new Date().toISOString(),start_time:null,end_time:null,daily_minutes:null};
     if(v.mode==='fixed'){if(!v.start_time||!v.end_time||v.end_time<=v.start_time)throw new Error('حدد بداية ونهاية صحيحتين (النهاية بعد البداية في نفس اليوم)');row.start_time=v.start_time;row.end_time=v.end_time}
     else{const h=parseFloat(v.hours);if(!(h>=0.25&&h<=16))throw new Error('الساعات اليومية بين 0.25 و 16');row.daily_minutes=Math.round(h*60)}
     await att.saveSchedule(row)}})},
 'att-delsched':async({id})=>{if(await confirmBox('حذف جدول هذا الموظف؟ لن تُحذف سجلاته السابقة.'))run(()=>att.delSchedule(id),'تم الحذف.').then(()=>app.reload())},
 'att-rules':()=>{const r=state.rules;form({title:'قواعد النقاط',init:{...r,absent_is_red:r.absent_is_red===false?'0':'1',fixed_grace_minutes:r.fixed_grace_minutes??120,early_window_minutes:r.early_window_minutes??120},fields:[{k:'late_threshold',l:'دقائق التأخير لتصبح نقطة حمراء',t:'number',mn:1,mx:240},{k:'early_threshold',l:'دقائق التبكير لتصبح نقطة خضراء',t:'number',mn:1,mx:240},{k:'greens_per_red',l:'عدد النقاط الخضراء التي تلغي نقطة حمراء',t:'number',mn:1,mx:20},{k:'absent_is_red',l:'الغياب',t:'select',o:[['1','يُحتسب نقطة حمراء تلقائيًا'],['0','لا يُحتسب']]},{k:'fixed_grace_minutes',l:'إغلاق الدوام الثابت تلقائيًا بعد نهايته بـ (دقيقة)',t:'number',mn:0,mx:720},{k:'early_window_minutes',l:'أقصى تبكير مسموح للبدء (دقيقة)',t:'number',mn:0,mx:720},{k:'tz',l:'المنطقة الزمنية (مثل Africa/Cairo)',req:1}],
   onSubmit:async v=>{try{new Intl.DateTimeFormat('en',{timeZone:v.tz})}catch{throw new Error('منطقة زمنية غير صحيحة')}
     await att.saveRules({tz:v.tz,late_threshold:+v.late_threshold,early_threshold:+v.early_threshold,greens_per_red:+v.greens_per_red,absent_is_red:v.absent_is_red==='1',fixed_grace_minutes:+v.fixed_grace_minutes,early_window_minutes:+v.early_window_minutes})}})},
 'att-dot':({id})=>{const d=byId(state.wdays,id);form({title:'تعديل النقطة',init:{dot:d.dot||'',note:d.dot_note||''},fields:[{k:'dot',l:'النقطة',t:'select',o:[['','بدون نقطة'],['red','حمراء'],['green','خضراء'],['blue','زرقاء']]},{k:'note',l:'سبب التعديل (يظهر للموظف)',t:'textarea'}],onSubmit:v=>att.setDay(id,{dot:v.dot||null,dot_note:v.note||null})})},
 'att-reopen':async({id})=>{if(await confirmBox('إعادة فتح اليوم؟ سيتمكن الموظف من الاستئناف.'))run(()=>att.reopen(id),'تم الحفظ.').then(after())},
 'att-delday':async({id})=>{if(await confirmBox())run(()=>att.delDay(id),'تم الحذف.').then(after())},
 'att-csv':()=>{const rows=[['employee','days','absent','hours','expected_hours','red','green','blue','net_red','avg_delta_min','late_min','early_min','overtime_min'],...sumRows().map(({uid,sm,ex})=>[nameOf(uid),sm.days,ex.absent,(sm.sec/3600).toFixed(2),(ex.minutes/60).toFixed(2),sm.red,sm.green,sm.blue,sm.net,sm.avg,sm.late,sm.early,sm.ot])];
   const b=new Blob(['\ufeff'+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`attendance-${state.attMonth}.csv`;a.click()},
 'att-admin-stop':({id})=>{const d=A.activeDay(id),fx=d?.mode==='fixed';form({title:`إيقاف مؤقّت — ${nameOf(id)}`,submit:'إيقاف',fields:[...(fx?[]:[{k:'close',l:'الإجراء',t:'select',o:[['0','إيقاف المؤقت فقط (يبقى اليوم مفتوحًا)'],['1','إيقاف وإنهاء اليوم وحساب النقاط']]}]),{k:'c',l:'ملاحظة (اختياري، تظهر للموظف)',t:'textarea'}],onSubmit:guard(v=>att.adminStop(id,v.c,fx||v.close==='1'))})},
 'att-sess-edit':({id})=>{const x=byId(state.wsess,id);form({title:'تعديل فترة العمل',init:{start:A.toLocalInput(x.started_at),end:x.ended_at?A.toLocalInput(x.ended_at):'',c:x.comment||''},fields:[{k:'start',l:'البداية',t:'datetime-local',req:1},{k:'end',l:x.ended_at?'النهاية':'النهاية (اتركها فارغة إن كانت الجلسة ما زالت جارية)',t:'datetime-local',...(x.ended_at?{req:1}:{})},{k:'c',l:'التعليق',t:'textarea'}],onSubmit:v=>att.editSession(id,v.start,v.end,v.c)})},
 'att-sess-add':({id})=>{const d=byId(state.wdays,id);form({title:'إضافة فترة عمل يدويًا',init:{start:d.work_date+'T09:00',end:d.work_date+'T10:00'},fields:[{k:'start',l:'البداية',t:'datetime-local',req:1},{k:'end',l:'النهاية',t:'datetime-local',req:1},{k:'c',l:'التعليق',t:'textarea'}],onSubmit:v=>att.addSession(id,v.start,v.end,v.c)})},
 'att-sess-del':async({id})=>{if(await confirmBox('حذف هذه الفترة؟ سيُعاد حساب اليوم.'))run(()=>att.delSession(id),'تم الحذف.').then(after())},
 'att-recalc':({id})=>run(()=>att.recalc(id),'تمت إعادة الحساب.').then(after()),
 'att-excuse':({id})=>form({title:'إعفاء من الغياب',fields:[{k:'n',l:'السبب (يظهر للموظف)',t:'textarea',req:1}],onSubmit:v=>att.setDay(id,{absent:false,dot:null,dot_note:v.n,summary:'معفى: '+v.n})}),
 'att-holi-add':()=>form({title:'إضافة عطلة رسمية',fields:[{k:'day',l:'التاريخ',t:'date',req:1},{k:'note',l:'الاسم/السبب',t:'text'}],onSubmit:v=>att.addHoliday(v.day,v.note)}),
 'att-holi-del':async({id})=>{if(await confirmBox('حذف هذه العطلة؟'))run(()=>att.delHoliday(id),'تم الحذف.').then(()=>app.reload())}
};
