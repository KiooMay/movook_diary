import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function connectAccountProfile(source){
  const from="acctBtn.textContent = user ? user.email.split('@')[0] : 'Conta';";
  if(source.split(from).length!==2)throw Error('Account label target missing or ambiguous');
  return source.replace(from,"acctBtn.textContent = window.__movookProfile?.label(user) || 'Conta';");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const path='_site/index.html';fs.writeFileSync(path,connectAccountProfile(fs.readFileSync(path,'utf8')));}
