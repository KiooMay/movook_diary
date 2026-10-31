import assert from 'node:assert/strict';
import {enableAvatarNavigation} from './connect-avatar.mjs';
import {avatarPath,imageType,validateImage,uploadAvatar,removeAvatar,ORIGINAL_LIMIT,STORED_LIMIT,updateStatus,isCloseControl,withTimeout,prepareAvatar} from '../site-src/avatar.mjs';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const png=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'});
assert.equal(avatarPath(id),id+'/avatar');assert.throws(()=>avatarPath('../other'));assert.equal(imageType(await png.arrayBuffer()),'image/png');await validateImage(png);
await assert.rejects(validateImage(new Blob(['<svg/>'],{type:'image/png'})),/Formato/);await assert.rejects(validateImage({size:ORIGINAL_LIMIT+1}),/limite/);await assert.rejects(validateImage({size:STORED_LIMIT+1},STORED_LIMIT),/limite/);
const calls=[];const client={auth:{getUser:async()=>({data:{user:{id}}})},storage:{from:bucket=>{assert.equal(bucket,'avatars');return {upload:async(path,blob,options)=>{calls.push({op:'upload',path,options});return {};},remove:async(paths)=>{calls.push({op:'remove',paths});return {};}};}}};
await uploadAvatar(client,id,png);assert.equal(calls[0].path,id+'/avatar');assert.deepEqual(calls[0].options,{upsert:true,contentType:'image/png',cacheControl:'0'});await removeAvatar(client,id);assert.deepEqual(calls[1].paths,[id+'/avatar']);
await assert.rejects(uploadAvatar(client,other,png),/conta mudou/);await assert.rejects(removeAvatar(client,id,()=>other),/conta mudou/);assert.equal(calls.length,2);
let value='',mutations=0,callbacks=0;const queue=[];const node={get textContent(){return value;},set textContent(v){value=v;mutations++;queue.push(draw);}};function draw(){callbacks++;updateStatus(node,'A preparar');}queue.push(draw);while(queue.length&&callbacks<100)queue.shift()();assert.equal(mutations,1);assert.equal(callbacks,2);assert.equal(queue.length,0);
assert.equal(isCloseControl({textContent:'Fechar',matches:()=>false}),true);assert.equal(isCloseControl({textContent:'Cancelar',matches:()=>false}),true);assert.equal(isCloseControl({textContent:'Guardar imagem',matches:()=>false}),false);
await assert.rejects(withTimeout(new Promise(()=>{}),5,'timeout'),/timeout/);assert.equal(await withTimeout(Promise.resolve(42),20,'timeout'),42);
let closed=0,drawArgs;globalThis.createImageBitmap=async()=>({width:100,height:200,close(){closed++;}});globalThis.document={createElement:()=>({getContext:()=>({drawImage(...args){drawArgs=args;},fillRect(){}}),toBlob(callback){callback(png);}})};
await prepareAvatar(png);assert.equal(closed,1);assert.deepEqual(drawArgs.slice(1),[0,50,100,100,0,0,256,256]);
const clock=Date.now;let ticks=0;Date.now=()=>ticks++===0?1000:17000;globalThis.document.createElement=()=>({getContext:()=>({drawImage(){}}),toBlob(){}});try{await assert.rejects(prepareAvatar(png),/15 segundos/);assert.equal(closed,2);}finally{Date.now=clock;delete globalThis.document;delete globalThis.createImageBitmap;}
assert.ok(enableAvatarNavigation("['addBtn','addLink'].includes(node.id)").includes("'avatarBtn'"));assert.throws(()=>enableAvatarNavigation('unexpected source'));
console.log('Avatar tests passed: observer settles, close stays available, preparation times out and private paths are preserved');
