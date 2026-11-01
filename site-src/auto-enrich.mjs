function init(){
  const wrap=()=>{
    const acct=window.__movookAccount;
    if(!acct||acct.__enrichWrapped)return;
    const original=acct.addPersonal?.bind(acct);
    if(!original)return;
    acct.__enrichWrapped=true;
    acct.addPersonal=async item=>{
      if(item&&['movie','series','anime'].includes(item.type)&&(!item.cover||!item.synopsis)&&window.__movookMetadata?.enrichNew){
        try{item=await window.__movookMetadata.enrichNew(item)||item;}catch{}
      }
      return original(item);
    };
  };
  let tries=0;
  const timer=setInterval(()=>{
    if(window.__movookAccount?.addPersonal){wrap();clearInterval(timer);}
    else if(++tries>240)clearInterval(timer);
  },250);
  window.addEventListener('movook:account',()=>queueMicrotask(wrap));
}
if(typeof document!=='undefined')init();
