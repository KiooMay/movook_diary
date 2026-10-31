import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function cleanNavigation(source){const from="[['cfgBtn','Definições'],['refreshBtn','Atualizar biblioteca']]";if(source.split(from).length!==2)throw Error('Refresh label target missing or ambiguous');return source.replace(from,"[['cfgBtn','Definições']]");}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const path='_site/interface.mjs';fs.writeFileSync(path,cleanNavigation(fs.readFileSync(path,'utf8')));}
