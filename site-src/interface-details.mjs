const icons=[[/^\s*✏[\uFE0F]?\s*/,'M16 3l5 5M4 20l4-1L21 6l-5-5L3 14l-1 8z'],[/^\s*🗑[\uFE0F]?\s*/,'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'],[/^\s*(?:\+|➕)[\uFE0F]?\s*(?=Adicionar)/,'M12 5v14M5 12h14']];
function decorate(root){
  const nodes=[...(root.matches?.('button,a.btn')?[root]:[]),...root.querySelectorAll('button,a.btn')];
  for(const button of nodes){
    if(button.id==='refreshBtn'||button.closest('#avatarBtn')||button.querySelector('svg,img'))continue;
    const text=[...button.childNodes].find(node=>node.nodeType===3&&node.nodeValue.trim());if(!text)continue;
    const match=icons.find(([pattern])=>pattern.test(text.nodeValue));if(!match)continue;
    text.nodeValue=text.nodeValue.replace(match[0],'');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('detail-action-icon');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',match[1]);svg.append(path);button.prepend(svg);
  }
}
function init(){
  const css=document.createElement('link');css.rel='stylesheet';css.href='interface-details.css';document.head.append(css);
  decorate(document.body);
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(node.nodeType===1)decorate(node);}}).observe(document.body,{childList:true,subtree:true});
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
