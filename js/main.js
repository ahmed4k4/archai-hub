import {state,isAdmin,byId} from './lib/store.js';
import {$,debounce} from './lib/utils.js';
import {t,L,setLang} from './lib/i18n.js';
import {auth,db,loadAll,loadAtt,live,unlive} from './services/api.js';
import {sched,startTicker} from './lib/att.js';
import {STALE_MS} from './config.js';
import {toast,closeModal,run,app} from './ui/ui.js';
import * as dash from './views/dashboard.js';
import * as P from './views/projects.js';
import * as K from './views/tasks.js';
import * as U from './views/team.js';
import * as R from './views/resources.js';
import * as AT from './views/attendance.js';
window.__booted=true;
const V={dashboard:['الرئيسية','fa-chart-pie',dash],projects:['المشاريع','fa-diagram-project',P],tasks:['لوحة المهام','fa-table-columns',K],attendance:['الحضور والانصراف','fa-clock',AT],team:['فريق العمل','fa-users-gear',U],resources:['الموارد والملفات','fa-folder-open',R]};
const ACTS={...P.act,...K.act,...U.act,...R.act,...AT.act,close:closeModal,
  nav:({v,id,tab})=>{closeModal();app.go(v,id,tab)},
  tab:({v})=>{document.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==v);document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v))}};
/* التوجيه عبر الـ hash: يبقى المستخدم في نفس الصفحة بعد أي تحديث للمتصفح */
const route=()=>{const[v,id,tab]=location.hash.replace(/^#\/?/,'').split('/');const k=v==='project'&&id?'project':V[v]?v:(localStorage.getItem('archai-view')||'dashboard');return{v:V[k]||k==='project'?k:'dashboard',id,tab:tab||'ov'}};
app.go=(v,id,tab)=>{const h=`#/${v}${id?'/'+id:''}${tab?'/'+tab:''}`;if(location.hash===h)render();else location.hash=h};
const navOk=k=>k==='team'?isAdmin():k==='attendance'?(isAdmin()||(state.attReady&&!!sched(state.user.id))):true;
const busy=()=>!$('#modal').hidden||(document.activeElement&&document.activeElement.closest?.('#view')&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
function render(){
  if(!state.user)return;
  let r=route();if(!navOk(r.v==='project'?'x':r.v))r={v:'dashboard'};
  const y=window.scrollY,isP=r.v==='project',m=isP?P:V[r.v][2],pj=isP&&byId(state.projects,r.id);
  const lbl=isP?(pj?.title||t('المشاريع')):t(V[r.v][0]);if(!isP)localStorage.setItem('archai-view',r.v);
  document.title='Archai — '+lbl;$('#title').textContent=lbl;$('#search').placeholder=t('بحث...');
  $('#nav').innerHTML=Object.entries(V).filter(([k])=>navOk(k)).map(([k,[l,i]])=>`<button data-a="nav" data-v="${k}" class="${k===(isP?'projects':r.v)?'on':''}"><i class="fa-solid ${i}"></i><span>${t(l)}</span></button>`).join('');
  $('#view').innerHTML=isP?P.workspace(r.id,r.tab):m.render();$('#lang-btn').textContent=L.lang==='ar'?'EN':'AR';
  if(m===K)K.bindDnd();if(isP)P.bindDz();window.scrollTo(0,y);
}
app.render=render;
app.reload=async()=>{await loadAll();render()};
const startLive=()=>{unlive();live(debounce(()=>busy()?(app.dirty=true):render(),400))};app.close=closeModal;
addEventListener('hashchange',()=>{closeModal();render()});
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el)return;if(el.tagName==='A')e.preventDefault();
  const fn=ACTS[el.dataset.a];if(fn){e.stopPropagation();fn({...el.dataset})}});
document.addEventListener('change',e=>{const d=e.target.dataset||{};
  if(d.ch&&ACTS[d.ch])return ACTS[d.ch]({...d,value:e.target.value});
  if(d.f){state.f[d.f]=e.target.type==='checkbox'?e.target.checked:e.target.value;render()}});
const show=s=>{$('#boot')?.remove();$('#auth').hidden=s!=='auth';$('#shell').hidden=s!=='app'};
async function start(session){
  state.session=session;state.user=session.user;
  try{state.profile=await auth.profile(session.user.id)}catch(e){console.error(e);await auth.logout();show('auth');return toast('تعذر التحقق من الصلاحيات.','error')}
  if(!state.profile||!['admin','user'].includes(state.profile.role)){await auth.logout();show('auth');return toast('الحساب لا يملك صلاحيات في النظام.','error')}
  $('#u-name').textContent=state.profile.full_name||state.user.email;$('#u-role').textContent=t(isAdmin()?'مدير':'موظف');$('#u-avatar').textContent=(state.profile.full_name||state.user.email)[0];
  show('app');
  try{await loadAll(true)}catch(e){console.error(e);toast('تعذر تحميل البيانات — راجع سياسات RLS.','error')}
  try{await loadAtt(null,true)}catch(e){state.attReady=false;console.warn('نظام الحضور غير مفعّل (شغّل supabase/attendance.sql):',e.message)}
  render();
  startLive();
}
/* جلسة واحدة فقط: لا نعيد التحميل عند تجديد التوكن، ونعرض الدخول فقط عند الخروج الفعلي */
db.auth.onAuthStateChange((ev,s)=>{
  if(ev==='SIGNED_OUT'&&state.user){state.user=null;state.profile=null;unlive();show('auth');toast('انتهت الجلسة، سجّل الدخول مرة أخرى.','error')}
  else if(ev==='TOKEN_REFRESHED'&&s)state.session=s});
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=$('#login-btn'),er=$('#login-error');b.disabled=true;er.hidden=true;
  try{const{session}=await auth.login($('#email').value.trim(),$('#password').value);await start(session)}catch(x){er.textContent=/invalid/i.test(x.message)?'البريد أو كلمة المرور غير صحيحة.':'تعذر تسجيل الدخول: '+x.message;er.hidden=false}finally{b.disabled=false}};
$('#logout-btn').onclick=async()=>{unlive();state.user=null;await auth.logout();location.hash='';show('auth')};
$('#refresh').onclick=()=>run(async()=>{await loadAll(true);render()},'تم الحفظ.');
/* توفير: نوقف الـ Realtime والتحميل عندما تكون التبويبة مخفية */
document.addEventListener('visibilitychange',async()=>{if(!state.user)return;if(document.hidden)return unlive();
  try{if(Date.now()-(state.loadedAt||0)>STALE_MS){await loadAll(true);if(state.attReady)await loadAtt(state.attMonth,true);render()}}catch(e){console.warn(e)}startLive()});
$('#search').oninput=debounce(e=>{state.search=e.target.value;render()},150);
$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();$('#search').focus()}});
$('#theme-btn').onclick=()=>{const n=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=n;localStorage.setItem('archai-theme',n)};
$('#lang-btn').onclick=()=>{setLang(L.lang==='ar'?'en':'ar');state.profile&&($('#u-role').textContent=t(isAdmin()?'مدير':'موظف'));render()};
startTicker();setInterval(()=>{if(state.user&&!busy()&&['attendance','dashboard'].includes(route().v))render()},60000);   // تحديث نصوص العدّ التنازلي كل دقيقة بدون أي طلب شبكة
document.documentElement.dataset.theme=localStorage.getItem('archai-theme')||'dark';setLang(L.lang);
(async()=>{try{const{session}=await auth.session();session?await start(session):show('auth')}catch(e){console.warn(e);try{await auth.logout()}catch{}show('auth')}})();   // توكن قديم => ننظفه بدل تكرار طلبات 400
