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
 decorate(document.body);
 new MutationObserver(records=>{for(const record of records){if(record.type==='attributes'){fixAdd(record.target);continue;}for(const node of record.addedNodes)if(node.nodeType===1)decorate(node);}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
