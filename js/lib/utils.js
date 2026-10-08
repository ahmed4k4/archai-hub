import {L} from './i18n.js';
export const $=s=>document.querySelector(s);
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmtDate=(v,time)=>{if(!v)return '-';const d=new Date(v);return isNaN(d)?'-':d.toLocaleDateString(L.lang==='en'?'en-GB':'ar-EG',time?{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short',year:'numeric'})};
export const fmtSize=n=>!n?'-':n<1024?n+' B':n<1048576?Math.round(n/1024)+' KB':(n/1048576).toFixed(1)+' MB';
export const avg=ts=>ts.length?Math.round(ts.reduce((a,t)=>a+Number(t.progress||0),0)/ts.length):0;
export const overdue=t=>t.due_date&&t.status!=='completed'&&new Date(t.due_date)<new Date(new Date().toDateString());
export const debounce=(f,ms)=>{let h;return(...a)=>{clearTimeout(h);h=setTimeout(()=>f(...a),ms)}};
export const safeName=n=>n.replace(/[^a-zA-Z0-9._-]/g,'_');
