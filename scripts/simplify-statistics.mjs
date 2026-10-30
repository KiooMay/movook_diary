import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function simplifyStatistics(source){
  const replacements=[["const s = insights?.summary, recs = insights?.recommendations || [];", "const recs = insights?.recommendations || [];"], ["if (!s?.text && !recs.length)", "if (!recs.length)"], ["${s?.text ? `<h2 class=\"sec\">✨ Resumo de ${esc(s.year)}</h2><div class=\"stat txt\">${esc(s.text)}</div>` : ''}", ""], ["<h2 class=\"sec\">Géneros mais frequentes</h2>${bars(count(items, (i) => i.genres))}", ""]];
  for(const [from,to] of replacements){if(source.split(from).length!==2)throw Error('Statistics target missing or ambiguous: '+from.slice(0,80));source=source.replace(from,to);}
  return source;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const path='_site/index.html';fs.writeFileSync(path,simplifyStatistics(fs.readFileSync(path,'utf8')));}
