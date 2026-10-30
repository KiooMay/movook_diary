import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function enableAvatarNavigation(source){const from="['addBtn','addLink'].includes(node.id)";if(source.split(from).length!==2)throw Error('Avatar navigation target missing or ambiguous');return source.replace(from,"['addBtn','addLink','avatarBtn'].includes(node.id)");}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const path='_site/interface.mjs';fs.writeFileSync(path,enableAvatarNavigation(fs.readFileSync(path,'utf8')));}
