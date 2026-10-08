import {SUPABASE_URL,SUPABASE_KEY,BUCKET,MAX_PDF,STORAGE_LIMIT,STORAGE_GUARD} from '../config.js';
import {state,byId} from '../lib/store.js';
import {safeName} from '../lib/utils.js';
export const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true},realtime:{params:{eventsPerSecond:5}}});
const ok=({data,error})=>{if(error)throw error;return data};
/* ---- تحميل ذكي: كل جدول يُحمّل فقط عند الحاجة (يوفر Egress وسجلات الـ API) ---- */
const Q={projects:['projects','projects',1],tasks:['tasks','tasks',1],profiles:['profiles','team',1],project_members:['project_members','members',0],files:['files','files',1],resources:['resources','resources',1],activity_logs:['activity_logs','activity',1,150]};
const dirty=new Set();
export const touch=(...n)=>n.forEach(x=>dirty.add(x));
const CASCADE={projects:['tasks','files','project_members','resources','activity_logs'],tasks:['files','activity_logs','resources'],files:['activity_logs']};
export async function loadAll(full=false){
  const names=full?Object.keys(Q):[...dirty];dirty.clear();if(!names.length)return;
  const rs=await Promise.all(names.map(n=>{const[tb,,ord,lim]=Q[n];let q=db.from(tb).select('*');if(ord)q=q.order('created_at',{ascending:false});if(lim)q=q.limit(lim);return q}));
  names.forEach((n,i)=>state[Q[n][1]]=ok(rs[i]));state.loadedAt=Date.now();
}
export const log=async(project_id,task_id,action,description)=>{touch('activity_logs');
  const{error}=await db.from('activity_logs').insert([{project_id:project_id||null,task_id:task_id||null,user_id:state.user.id,action,description:String(description||'').slice(0,240)}]);
  if(error)console.warn('activity log skipped:',error.message)};      // لا نكسر العملية بسبب السجل
export const auth={session:()=>db.auth.getSession().then(ok),login:(email,password)=>db.auth.signInWithPassword({email,password}).then(ok),logout:()=>db.auth.signOut({scope:'local'}),profile:id=>db.from('profiles').select('*').eq('id',id).maybeSingle().then(ok)};
export const tbl=n=>({add:async o=>{touch(n);return ok(await db.from(n).insert([o]).select().single())},set:async(id,o)=>{touch(n);return ok(await db.from(n).update(o).eq('id',id))},del:async id=>{touch(n,...(CASCADE[n]||[]));return ok(await db.from(n).delete().eq('id',id))}});
export async function admin(payload){
  const{data:{session}}=await db.auth.getSession();if(!session)throw new Error('الجلسة منتهية');touch('profiles');
  const r=await fetch(`${SUPABASE_URL}/functions/v1/admin-users`,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let d={};try{d=await r.json()}catch{}if(!r.ok||d.error)throw new Error(d.error||'Server error '+r.status);return d}
export async function addResources(rows){if(!rows.length)return;touch('resources');
  const{error}=await db.from('resources').insert(rows);if(error){if(/task_id/.test(error.message||''))throw new Error('نفّذ ملف supabase/links.sql مرة واحدة لتفعيل روابط المهام.');throw error}}
export async function syncMembers(pid,ids){touch('project_members');
  const cur=state.members.filter(m=>m.project_id===pid).map(m=>m.user_id),del=cur.filter(u=>!ids.includes(u)),add=ids.filter(u=>!cur.includes(u));
  for(const u of del)ok(await db.from('project_members').delete().eq('project_id',pid).eq('user_id',u));
  if(add.length)ok(await db.from('project_members').insert(add.map(user_id=>({project_id:pid,user_id,role:'member'}))))}
/* ---- الملفات: مسار مطابق للأصل projects/<uuid>/..، منع التكرار، وحارس مساحة ---- */
export const usedBytes=()=>state.files.reduce((a,f)=>a+Number(f.file_size||0),0);
export async function upload(file,{project_id,task_id=null,name}){
  if(!project_id)throw new Error('اختر المشروع أولًا.');
  if(file.type!=='application/pdf')throw new Error('PDF فقط.');
  if(file.size>MAX_PDF)throw new Error('الحد الأقصى للملف '+MAX_PDF/1048576+'MB.');
  if(state.files.some(f=>f.project_id===project_id&&(f.task_id||null)===(task_id||null)&&f.file_size===file.size&&(f.file_name===(name||file.name))))throw new Error('هذا الملف مرفوع بالفعل.');
  if(usedBytes()+file.size>STORAGE_LIMIT*STORAGE_GUARD)throw new Error('مساحة التخزين شبه ممتلئة، احذف ملفات قديمة.');
  const path=`projects/${project_id}/${task_id?'tasks/'+task_id:'documentation'}/${crypto.randomUUID()}-${safeName(file.name)}`;
  ok(await db.storage.from(BUCKET).upload(path,file,{contentType:'application/pdf',cacheControl:'3600'}));touch('files');
  try{await tbl('files').add({project_id,task_id,uploaded_by:state.user.id,file_name:name||file.name,file_path:path,file_size:file.size,mime_type:'application/pdf'})}
  catch(e){await db.storage.from(BUCKET).remove([path]);throw e}}
const urls=new Map();
export async function signedUrl(p,dl){const k=p+(dl?'#d':''),c=urls.get(k);if(c&&c.exp>Date.now())return c.u;
  const u=ok(await db.storage.from(BUCKET).createSignedUrl(p,600,dl?{download:true}:undefined)).signedUrl;urls.set(k,{u,exp:Date.now()+540000});return u}
const rmObjects=async rows=>{if(rows.length)await db.storage.from(BUCKET).remove(rows.map(f=>f.file_path)).catch(e=>console.warn(e))};
export async function removeFile(id){const f=byId(state.files,id);await tbl('files').del(id);await rmObjects([f])}
/* حذف المشروع/المهمة يحذف ملفاتها من التخزين أيضًا (لا ملفات يتيمة تستهلك المساحة) */
export async function delProject(id){const rows=state.files.filter(f=>f.project_id===id);await tbl('projects').del(id);await rmObjects(rows)}
export async function delTask(id){const rows=state.files.filter(f=>f.task_id===id);await tbl('tasks').del(id);await rmObjects(rows)}
/* ---- Realtime: نطبّق التغيير مباشرة على الحالة بدون أي إعادة جلب ---- */
const MAP={projects:'projects',tasks:'tasks',profiles:'team',project_members:'members',files:'files',resources:'resources',activity_logs:'activity'};
const same=(t,a,b)=>t==='project_members'?a.project_id===b.project_id&&a.user_id===b.user_id:a.id===b.id;
export function live(onChange){
  let ch=db.channel('hub');
  Object.entries(MAP).forEach(([table,key])=>{ch=ch.on('postgres_changes',{event:'*',schema:'public',table},p=>{
    const arr=state[key],n=p.new,o=p.old;
    if(p.eventType==='DELETE'){const hit=table==='project_members'?(o.project_id&&o.user_id):o.id;
      if(!hit){touch(table);return onChange(true)}state[key]=arr.filter(x=>!same(table,x,o))}
    else{const i=arr.findIndex(x=>same(table,x,n));if(i>=0)arr[i]=n;else arr.unshift(n);if(key==='activity'&&arr.length>150)arr.length=150}
    onChange(false)})});
  ch.subscribe();}
export const unlive=()=>{db.removeAllChannels()};
