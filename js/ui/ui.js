import {$,esc} from '../lib/utils.js';
import {t} from '../lib/i18n.js';
export const app={};
export function toast(m,type='ok'){const d=document.createElement('div');d.className='toast '+(type==='error'?'error':'');d.textContent=m;$('#toasts').append(d);setTimeout(()=>d.remove(),3800)}
export const openModal=(h,wide)=>{$('#modal-box').className='card modal-box'+(wide?' wide':'');$('#modal-box').innerHTML=h;$('#modal').hidden=false};
export const closeModal=()=>{$('#modal').hidden=true;$('#modal-box').innerHTML='';if(app.dirty){app.dirty=false;app.render?.()}};
export const empty=(i='fa-inbox',x='لا توجد بيانات')=>`<div class="empty"><i class="fa-solid ${i} fa-2x"></i><p>${esc(t(x))}</p></div>`;
export const bar=p=>`<div class="bar"><i style="width:${Math.min(100,p||0)}%"></i></div>`;
export const badge=(c,l)=>`<span class="badge ${c}">${esc(t(l))}</span>`;
export const head=(title)=>`<div class="head"><h3>${esc(t(title))}</h3><button class="icon" data-a="close"><i class="fa-solid fa-xmark"></i></button></div>`;
export async function run(fn,msg){try{await fn();msg&&toast(t(msg));return true}catch(e){console.error(e);toast(e.message||'Error','error');return false}}
export const confirmBox=txt=>new Promise(r=>{openModal(`<p style="margin-bottom:16px">${esc(t(txt||'هل أنت متأكد؟ الإجراء نهائي.'))}</p><div class="actions"><button class="btn danger" id="y">${t('تأكيد')}</button><button class="btn" id="n">${t('إلغاء')}</button></div>`);$('#y').onclick=()=>{closeModal();r(true)};$('#n').onclick=()=>{closeModal();r(false)}});
/* مولّد نماذج موحّد: fields=[{k,l,t,o,req,def,multi,acc}] */
export function form({title,fields,init={},submit='حفظ',onSubmit}){
  const f=x=>{const v=init[x.k]??x.def??'',a=`id="f-${x.k}" ${x.req?'required':''}`;let c;
    if(x.t==='select')c=`<select ${a}>${x.o.map(([val,l])=>`<option value="${esc(val)}" ${String(v)===String(val)?'selected':''}>${esc(t(l))}</option>`).join('')}</select>`;
    else if(x.t==='textarea')c=`<textarea ${a} rows="3" placeholder="${esc(t(x.ph||''))}">${esc(v)}</textarea>`;
    else if(x.t==='checks')c=`<div class="checks">${x.o.map(([val,l])=>`<label class="chk"><input type="checkbox" name="f-${x.k}" value="${esc(val)}" ${(init[x.k]||[]).includes(val)?'checked':''}>${esc(l)}</label>`).join('')||'<small>—</small>'}</div>`;
    else c=`<input ${a} type="${x.t||'text'}" value="${x.t==='file'||x.t==='password'?'':esc(v)}" ${x.acc?`accept="${x.acc}"`:''} ${x.multi?'multiple':''} ${x.t==='number'?`min="${x.mn??0}" max="${x.mx??100}" step="${x.step??1}"`:''} ${x.min?`minlength="${x.min}"`:''}>`;
    return `<label>${esc(t(x.l))}${c}</label>`};
  openModal(head(title)+`<form id="mf">${fields.map(f).join('')}<button class="btn primary block">${esc(t(submit))}</button></form>`);
  $('#mf').onsubmit=async e=>{e.preventDefault();const v={};
    fields.forEach(x=>v[x.k]=x.t==='checks'?[...document.querySelectorAll(`[name="f-${x.k}"]:checked`)].map(c=>c.value):x.t==='file'?[...$('#f-'+x.k).files]:$('#f-'+x.k).value.trim());
    const b=e.submitter;b.disabled=true;if(await run(()=>onSubmit(v),'تم الحفظ.')){closeModal();await app.reload()}b.disabled=false};
}
