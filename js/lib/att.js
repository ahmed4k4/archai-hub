import {state} from './store.js';
const pad=n=>String(n).padStart(2,'0');
export const tz=()=>state.rules?.tz||'Africa/Cairo';
export const nowMs=()=>Date.now()+(state.srvOff||0);
export const ymd=ms=>new Date(ms).toLocaleDateString('en-CA',{timeZone:tz()});
export const today=()=>ymd(nowMs());
export const dowOf=d=>new Date(d+'T00:00:00Z').getUTCDay();
export const hm=v=>v?new Date(v).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:tz()}):'—';
export const dur=s=>{s=Math.max(0,Math.floor(s));return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`};
export const durS=s=>{const m=Math.round(Math.max(0,s)/60),h=Math.floor(m/60);return h?`${h}س ${m%60}د`:`${m}د`};
export const hooks={};
export const secsOfDay=ms=>{const p=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:tz()}).formatToParts(ms),g=k=>+p.find(x=>x.type===k).value;return g('hour')*3600+g('minute')*60+g('second')};
export const toLocalInput=iso=>new Date(iso).toLocaleString('sv-SE',{timeZone:tz()}).replace(' ','T').slice(0,16);
export const minsOfDay=ms=>{const p=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:tz()}).formatToParts(ms);return +p.find(x=>x.type==='hour').value*60+ +p.find(x=>x.type==='minute').value};
export const tmin=t=>{const[h,m]=String(t).split(':');return +h*60+ +m};
export const monthRange=m=>{const[y,mo]=m.split('-').map(Number);return [`${m}-01`,mo===12?`${y+1}-01-01`:`${y}-${pad(mo+1)}-01`]};
export const DOT={red:['حمراء','var(--bad)'],green:['خضراء','var(--ok)'],blue:['زرقاء','#4a90ff']};
export const dotEl=(d,big)=>d?`<i class="dot ${d}${big?' big':''}" title="${DOT[d][0]}"></i>`:'<i class="dot none"></i>';
export const sched=uid=>state.wsched?.find(s=>s.user_id===uid&&s.active);
export const dayOf=(uid,date=today())=>state.wdays?.find(d=>d.user_id===uid&&d.work_date===date);
/* اليوم النشط: يوم اليوم، أو يوم قديم لم يُغلق بعد (قبل أن يكنسه السيرفر) */
export const activeDay=uid=>dayOf(uid)||state.wdays?.find(d=>d.user_id===uid&&!d.closed);
/* أقصى وقت يمكن أن يستمر فيه المؤقت المفتوح: منتصف الليل، أو نهاية الدوام الثابت + فترة السماح */
export function capOf(d){const n=nowMs(),st=Math.floor(n/1000)*1000-secsOfDay(n)*1000,diff=Math.round((Date.parse(today()+'T00:00:00Z')-Date.parse(d.work_date+'T00:00:00Z'))/864e5);
  let cap=st-(diff-1)*864e5;if(d.mode==='fixed'&&!d.off_day&&d.sched_end)cap=Math.min(cap,st-diff*864e5+(tmin(d.sched_end)+(state.rules?.fixed_grace_minutes??120))*60000);return cap}
export const sessOf=id=>(state.wsess||[]).filter(s=>s.day_id===id).sort((a,b)=>new Date(a.started_at)-new Date(b.started_at));
export const openOf=uid=>(state.wsess||[]).find(s=>s.user_id===uid&&!s.ended_at);
export function workedSec(d,now=nowMs()){const ss=sessOf(d.id),cap=d.closed?Infinity:capOf(d);return ss.length?ss.reduce((a,s)=>a+Math.max(0,((s.ended_at?+new Date(s.ended_at):Math.min(now,cap))-+new Date(s.started_at))/1000),0):d.worked_seconds||0}
export const baseSec=d=>sessOf(d.id).filter(s=>s.ended_at).reduce((a,s)=>a+(+new Date(s.ended_at)-+new Date(s.started_at))/1000,0);
export const status=uid=>{if(!sched(uid))return null;const d=activeDay(uid);return d?.closed?'done':openOf(uid)?'working':d?'paused':'idle'};
export const STATUS_LBL={working:['يعمل الآن','st-in_progress'],paused:['متوقف مؤقتًا','st-paused'],done:['أنهى اليوم','st-completed'],idle:['لم يبدأ','st-planning']};
export function deltaInfo(d){if(!d)return null;if(d.absent)return{txt:'غياب',tone:'bad'};const tone=d.dot==='red'?'bad':d.dot==='green'?'ok':d.dot==='blue'?'blue':'';
  if(d.mode==='fixed'){if(d.start_delta==null)return{txt:'يوم خارج الجدول',tone};const m=Math.abs(d.start_delta);
    const base=d.start_delta>0?`تأخّر ${m} د`:d.start_delta<0?`بكّر ${m} د`:'في الموعد تمامًا';return{txt:d.dot==='blue'&&m>0?base+' (ضمن المسموح)':base,tone}}
  if(!d.closed)return{txt:'جارٍ العمل',tone:''};const diff=Math.round(workedSec(d)/60)-(d.target_minutes||0);
  return{txt:d.off_day?'يوم خارج الجدول':diff<0?`ناقص ${-diff} د عن الهدف`:diff>0?`زائد ${diff} د عن الهدف`:'حقق الهدف تمامًا',tone}}
export const endInfo=d=>d?.end_delta==null?null:d.end_delta>0?`خرج متأخرًا ${d.end_delta} د`:d.end_delta<0?`خرج مبكرًا ${-d.end_delta} د`:'خرج في الموعد';
export function summary(uid,days){const my=days.filter(d=>d.user_id===uid),c={red:0,green:0,blue:0};my.forEach(d=>d.dot&&c[d.dot]++);
  const gpr=state.rules?.greens_per_red||2,off=Math.floor(c.green/gpr),fx=my.filter(d=>d.mode==='fixed'&&d.start_delta!=null);
  return{...c,off,gpr,net:Math.max(0,c.red-off),days:my.filter(d=>d.first_start).length,sec:my.reduce((a,d)=>a+workedSec(d),0),
    late:fx.reduce((a,d)=>a+Math.max(0,d.start_delta),0),early:fx.reduce((a,d)=>a+Math.max(0,-d.start_delta),0),
    avg:fx.length?Math.round(fx.reduce((a,d)=>a+d.start_delta,0)/fx.length):0,ot:my.reduce((a,d)=>a+Math.max(0,d.end_delta||0),0),leftEarly:my.reduce((a,d)=>a+Math.max(0,-(d.end_delta||0)),0)}}
export function expected(uid,month){const s=state.wsched?.find(x=>x.user_id===uid&&x.active);if(!s)return{minutes:0,days:0,absent:0};
  const per=s.mode==='fixed'?tmin(s.end_time)-tmin(s.start_time):s.daily_minutes,[from,to]=monthRange(month),td=today(),cr=ymd(+new Date(s.created_at)),dates=[];
  const end=new Date(to+'T00:00:00Z');for(let d=new Date(Math.max(+new Date(from+'T00:00:00Z'),+new Date(cr+'T00:00:00Z')));d<end;d=new Date(+d+864e5)){const k=d.toISOString().slice(0,10);if(k>td)break;
    if(s.work_days.includes(d.getUTCDay())&&!(state.wholi||[]).some(h=>h.day===k)&&(k<td||dayOf(uid,k)))dates.push(k)}
  return{minutes:dates.length*per,days:dates.length,absent:dates.filter(k=>{const r=(state.wdays||[]).find(d=>d.user_id===uid&&d.work_date===k);return !r||r.absent}).length}}
/* عدّاد حيّ: يحدّث العناصر فقط بدون إعادة رسم الصفحة */
export function startTicker(){setInterval(()=>{const n=nowMs();
  document.querySelectorAll('[data-tick]').forEach(e=>{const s=+e.dataset.since,c=+e.dataset.cap||Infinity;e.textContent=dur(+e.dataset.base+(s?(Math.min(n,c)-s)/1000:0))});
  const o=state.user&&openOf(state.user.id);if(o){const d=state.wdays.find(x=>x.id===o.day_id);if(d)document.title='⏱ '+dur(workedSec(d,n))+' · Archai'}
  /* انتهى وقت مؤقت مفتوح (منتصف الليل/نهاية الدوام): اطلب الإغلاق التلقائي وحدّث الحالة */
  if(hooks.sweep&&(state.wsess||[]).some(s=>{if(s.ended_at)return false;const d=state.wdays.find(x=>x.id===s.day_id);return d&&!d.closed&&n>capOf(d)+3000}))hooks.sweep()},1000)}
