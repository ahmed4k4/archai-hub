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
export const minsOfDay=ms=>{const p=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:tz()}).formatToParts(ms);return +p.find(x=>x.type==='hour').value*60+ +p.find(x=>x.type==='minute').value};
export const tmin=t=>{const[h,m]=String(t).split(':');return +h*60+ +m};
export const monthRange=m=>{const[y,mo]=m.split('-').map(Number);return [`${m}-01`,mo===12?`${y+1}-01-01`:`${y}-${pad(mo+1)}-01`]};
export const DOT={red:['حمراء','var(--bad)'],green:['خضراء','var(--ok)'],blue:['زرقاء','#4a90ff']};
export const dotEl=(d,big)=>d?`<i class="dot ${d}${big?' big':''}" title="${DOT[d][0]}"></i>`:'<i class="dot none"></i>';
export const sched=uid=>state.wsched?.find(s=>s.user_id===uid&&s.active);
export const dayOf=(uid,date=today())=>state.wdays?.find(d=>d.user_id===uid&&d.work_date===date);
export const sessOf=id=>(state.wsess||[]).filter(s=>s.day_id===id).sort((a,b)=>new Date(a.started_at)-new Date(b.started_at));
export const openOf=uid=>(state.wsess||[]).find(s=>s.user_id===uid&&!s.ended_at);
export function workedSec(d,now=nowMs()){const ss=sessOf(d.id);return ss.length?ss.reduce((a,s)=>a+((s.ended_at?+new Date(s.ended_at):now)-+new Date(s.started_at))/1000,0):d.worked_seconds||0}
export const baseSec=d=>sessOf(d.id).filter(s=>s.ended_at).reduce((a,s)=>a+(+new Date(s.ended_at)-+new Date(s.started_at))/1000,0);
export const status=uid=>{if(!sched(uid))return null;const d=dayOf(uid);return d?.closed?'done':openOf(uid)?'working':d?'paused':'idle'};
export const STATUS_LBL={working:['يعمل الآن','st-in_progress'],paused:['متوقف مؤقتًا','st-paused'],done:['أنهى اليوم','st-completed'],idle:['لم يبدأ','st-planning']};
export function deltaInfo(d){if(!d)return null;const tone=d.dot==='red'?'bad':d.dot==='green'?'ok':d.dot==='blue'?'blue':'';
  if(d.mode==='fixed'){if(d.start_delta==null)return{txt:'يوم خارج الجدول',tone};const m=Math.abs(d.start_delta);
    const base=d.start_delta>0?`تأخّر ${m} د`:d.start_delta<0?`بكّر ${m} د`:'في الموعد تمامًا';return{txt:d.dot==='blue'&&m>0?base+' (ضمن المسموح)':base,tone}}
  if(!d.closed)return{txt:'جارٍ العمل',tone:''};const diff=Math.round(workedSec(d)/60)-(d.target_minutes||0);
  return{txt:d.off_day?'يوم خارج الجدول':diff<0?`ناقص ${-diff} د عن الهدف`:diff>0?`زائد ${diff} د عن الهدف`:'حقق الهدف تمامًا',tone}}
export const endInfo=d=>d?.end_delta==null?null:d.end_delta>0?`خرج متأخرًا ${d.end_delta} د`:d.end_delta<0?`خرج مبكرًا ${-d.end_delta} د`:'خرج في الموعد';
export function summary(uid,days){const my=days.filter(d=>d.user_id===uid),c={red:0,green:0,blue:0};my.forEach(d=>d.dot&&c[d.dot]++);
  const gpr=state.rules?.greens_per_red||2,off=Math.floor(c.green/gpr),fx=my.filter(d=>d.mode==='fixed'&&d.start_delta!=null);
  return{...c,off,gpr,net:Math.max(0,c.red-off),days:my.length,sec:my.reduce((a,d)=>a+workedSec(d),0),
    late:fx.reduce((a,d)=>a+Math.max(0,d.start_delta),0),early:fx.reduce((a,d)=>a+Math.max(0,-d.start_delta),0),
    avg:fx.length?Math.round(fx.reduce((a,d)=>a+d.start_delta,0)/fx.length):0,ot:my.reduce((a,d)=>a+Math.max(0,d.end_delta||0),0),leftEarly:my.reduce((a,d)=>a+Math.max(0,-(d.end_delta||0)),0)}}
export function expected(uid,month){const s=state.wsched?.find(x=>x.user_id===uid&&x.active);if(!s)return{minutes:0,days:0,absent:0};
  const per=s.mode==='fixed'?tmin(s.end_time)-tmin(s.start_time):s.daily_minutes,[from,to]=monthRange(month),td=today(),cr=ymd(+new Date(s.created_at)),dates=[];
  const end=new Date(to+'T00:00:00Z');for(let d=new Date(Math.max(+new Date(from+'T00:00:00Z'),+new Date(cr+'T00:00:00Z')));d<end;d=new Date(+d+864e5)){const k=d.toISOString().slice(0,10);if(k>td)break;
    if(s.work_days.includes(d.getUTCDay())&&(k<td||dayOf(uid,k)))dates.push(k)}
  return{minutes:dates.length*per,days:dates.length,absent:dates.filter(k=>!(state.wdays||[]).some(d=>d.user_id===uid&&d.work_date===k)).length}}
/* عدّاد حيّ: يحدّث العناصر فقط بدون إعادة رسم الصفحة */
export function startTicker(){setInterval(()=>{const n=nowMs();
  document.querySelectorAll('[data-tick]').forEach(e=>{const s=+e.dataset.since;e.textContent=dur(+e.dataset.base+(s?(n-s)/1000:0))});
  const o=state.user&&openOf(state.user.id);if(o){const d=state.wdays.find(x=>x.id===o.day_id);if(d)document.title='⏱ '+dur(workedSec(d,n))+' · Archai'}},1000)}
