const icons=[[/^\s*✏[\uFE0F]?\s*/,'M16 3l5 5M4 20l4-1L21 6l-5-5L3 14l-1 8z'],[/^\s*🗑[\uFE0F]?\s*/,'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7']];
function fixAdd(root){
 const buttons=[...(root.matches?.('#addBtn,#addLink')?[root]:[]),...root.querySelectorAll('#addBtn,#addLink')];
 for(const button of buttons){
  if(button.textContent!=='+ Adicionar'||button.children.length)button.textContent='+ Adicionar';
  const rules={display:'inline-flex','align-items':'center','justify-content':'center',width:'max-content','min-width':'max-content','max-width':'none',height:'38px','min-height':'38px','max-height':'38px',flex:'0 0 auto',padding:'0 10px','font-size':'13px','line-height':'1','white-space':'nowrap','overflow':'visible','text-indent':'0','letter-spacing':'normal','aspect-ratio':'auto','box-sizing':'border-box',transform:'none'};
  for(const [key,value] of Object.entries(rules))button.style.setProperty(key,value,'important');
  if(button.hidden)button.style.setProperty('display','none','important');
 }
}
function decorate(root){
 fixAdd(root);
 const nodes=[...(root.matches?.('button,a.btn')?[root]:[]),...root.querySelectorAll('button,a.btn')];
 for(const button of nodes){
  if(['addBtn','addLink','refreshBtn'].includes(button.id)||button.closest('#avatarBtn')||button.querySelector('svg,img'))continue;
  const text=[...button.childNodes].find(node=>node.nodeType===3&&node.nodeValue.trim());if(!text)continue;
  const match=icons.find(([pattern])=>pattern.test(text.nodeValue));if(!match)continue;
  text.nodeValue=text.nodeValue.replace(match[0],'');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','16');svg.setAttribute('height','16');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('detail-action-icon');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',match[1]);svg.append(path);button.prepend(svg);
 }
}
function init(){
 const css=document.createElement('link');css.rel='stylesheet';css.href='interface-details.css';document.head.append(css);
 const noteStyle=document.createElement('style');noteStyle.textContent='#notes .notes-grid,#notes #notesGrid{grid-auto-rows:1fr!important;align-items:stretch!important}#notes .note-card{height:100%!important;box-sizing:border-box;display:flex!important;flex-direction:column!important}#notes .note-card .note-actions{display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;align-items:stretch!important;justify-content:flex-end!important;gap:6px!important;min-height:152px!important;box-sizing:border-box!important;padding:8px!important;margin-top:auto!important;flex-shrink:0!important}body #notes .note-card .note-actions .btn{display:block!important;flex:0 0 auto!important;width:100%!important;max-width:none!important;min-width:0!important;min-height:40px!important;height:auto!important;padding:8px 4px!important;font-size:13px!important;line-height:1.4!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere!important;text-align:center!important;box-sizing:border-box!important}#notes .note-card .note-cover{position:relative!important;overflow:hidden!important;flex-shrink:0!important;padding:0!important}#notes .note-card .note-cover img{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;object-fit:cover!important;object-position:50% 50%!important;margin:0!important;transform:none!important}';document.head.append(noteStyle);
 decorate(document.body);
 new MutationObserver(records=>{for(const record of records){if(record.type==='attributes'){fixAdd(record.target);continue;}for(const node of record.addedNodes)if(node.nodeType===1)decorate(node);}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
