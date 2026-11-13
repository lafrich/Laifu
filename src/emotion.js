import {FRAME,VIEWS} from './constants.js';
export const EMOTION_FORMAT='laifu.emotion.v1';
export const EMOTION_DATABASE_FORMAT='laifu.emotion.database.v1';
export const EMOTION_MAX_FRAMES=48;
const clone=v=>JSON.parse(JSON.stringify(v));
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'emo_'+Math.random().toString(36).slice(2);
const hex=c=>typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c);
export const blankFrame=()=>({pixels:{}});
export function createEmotion(name='New Emotion',frames=1){
 const n=cap(Math.floor(Number(frames)||1),1,EMOTION_MAX_FRAMES);
 return {format:EMOTION_FORMAT,id:uid(),name:String(name).slice(0,70),fps:12,loop:true,frameCount:n,anchor:{bone:'head',x:32,y:40},
 placement:Object.fromEntries(VIEWS.map(v=>[v,{x:0,y:0,scale:1,enabled:true}])),
 views:Object.fromEntries(VIEWS.map(v=>[v,{frames:Array.from({length:n},blankFrame)}]))};
}
export function createDemoTalk(){
 const e=createEmotion('Talk / 9 shapes',9);
 for(const v of VIEWS){
  for(let i=0;i<9;i++){
   if(v==='back')continue;
   const frame=e.views[v].frames[i],p=frame.pixels,shift=v==='left'?-5:v==='right'?5:0;
   for(const dx of [-5,5])for(let x=0;x<2;x++)for(let y=0;y<2;y++)p[String(32+shift+dx+x)+','+String(31+y)]='#29313f';
   const half=i===0?2:Math.min(4,1+Math.floor(i/2));
   const tall=i===0?1:i%3===0?4:i%3===1?2:3;
   for(let yy=0;yy<tall;yy++)for(let xx=-half;xx<=half;xx++){
    const edge=yy===0||yy===tall-1||xx===-half||xx===half;
    p[String(32+shift+xx)+','+String(38+yy)]=edge?'#713f37':'#54303a';
   }
  }
 }
 return e;
}
export const createEmotionDatabase=()=>{const emo=createDemoTalk();return {format:EMOTION_DATABASE_FORMAT,version:1,emotions:[emo],activeEmotionId:emo.id};};
const normalizeFrame=f=>{const pixels={};for(const [pos,color] of Object.entries(f?.pixels||{})){
 const m=/^(\d{1,3}),(\d{1,3})$/.exec(pos);
 if(m&&+m[1]<FRAME.width&&+m[2]<FRAME.height&&hex(color))pixels[pos]=color.toLowerCase();
 }return {pixels};};
export function normalizeEmotion(input){
 if(!input||input.format!==EMOTION_FORMAT)throw Error('Bukan laifu.emotion.v1');
 const e=createEmotion(input.name||'Emotion',input.frameCount);
 e.id=String(input.id||e.id).slice(0,120);e.fps=cap(Math.round(Number(input.fps)||12),1,30);e.loop=input.loop!==false;
 for(const v of VIEWS){
  const frames=input.views?.[v]?.frames;
  e.views[v].frames=Array.from({length:e.frameCount},(_,i)=>normalizeFrame(frames?.[i]));
  const pos=input.placement?.[v]||{};
  e.placement[v]={x:cap(Number(pos.x)||0,-24,24),y:cap(Number(pos.y)||0,-24,24),scale:cap(Number(pos.scale)||1,.25,3),enabled:pos.enabled!==false};
 }
 // All emotions stay an overlay of the head bone, never a separate face rig.
 e.anchor={bone:'head',x:32,y:40};
 return e;
}
export function normalizeEmotionDatabase(data){
 if(data?.format===EMOTION_FORMAT){const em=normalizeEmotion(data);return {format:EMOTION_DATABASE_FORMAT,version:1,emotions:[em],activeEmotionId:em.id};}
 if(!data||data.format!==EMOTION_DATABASE_FORMAT||!Array.isArray(data.emotions))throw Error('File bukan database Laifu Emosi');
 if(data.emotions.length>100)throw Error('Maksimum 100 ekspresi');
 const emotions=data.emotions.map(normalizeEmotion);
 const seen=new Set();for(const e of emotions){if(seen.has(e.id))e.id=uid();seen.add(e.id);}
 return {format:EMOTION_DATABASE_FORMAT,version:1,emotions,activeEmotionId:seen.has(data.activeEmotionId)?data.activeEmotionId:emotions[0]?.id||null};
}
export function paintPixel(e,view,index,x,y,color){
 const f=e.views?.[view]?.frames[index];if(!f)throw Error('Arah atau frame tidak ditemukan');
 x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=FRAME.width||y>=FRAME.height)return false;
 const pos=x+','+y,old=f.pixels[pos]||null;
 if(color===null){if(!old)return false;delete f.pixels[pos];return true;}
 if(!hex(color))throw Error('Warna harus HEX');
 if(old===color)return false;f.pixels[pos]=color;return true;
}
export function fillRegion(e,view,index,x,y,color){
 x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=FRAME.width||y>=FRAME.height)return 0;
 const f=e.views[view].frames[index],target=f.pixels[x+','+y]||null;
 if(target===color)return 0;
 const seen=new Set(),stack=[[x,y]];let changes=0;
 while(stack.length){
  const [px,py]=stack.pop(),key=px+','+py;
  if(px<0||py<0||px>=FRAME.width||py>=FRAME.height||seen.has(key))continue;
  seen.add(key);if((f.pixels[key]||null)!==target)continue;
  if(paintPixel(e,view,index,px,py,color))changes++;
  stack.push([px+1,py],[px-1,py],[px,py+1],[px,py-1]);
 }return changes;
}
export function copyFrame(e,view,index){return clone(e.views[view].frames[index]);}
export function moveFrame(e,view,index,dx,dy){
 const pixels={};for(const [pos,col] of Object.entries(e.views[view].frames[index].pixels)){
  const [x,y]=pos.split(',').map(Number),px=x+dx,py=y+dy;
  if(px>=0&&py>=0&&px<FRAME.width&&py<FRAME.height)pixels[px+','+py]=col;
 }
 e.views[view].frames[index].pixels=pixels;
}
export function flipFrame(e,view,index){
 const pixels={};for(const [pos,col] of Object.entries(e.views[view].frames[index].pixels)){
  const [x,y]=pos.split(',').map(Number);pixels[(FRAME.width-1-x)+','+y]=col;
 }
 e.views[view].frames[index].pixels=pixels;
}
export function insertFrame(e,index,duplicate=false){
 if(e.frameCount>=EMOTION_MAX_FRAMES)return false;
 const at=cap(Math.floor(index),0,e.frameCount);
 for(const v of VIEWS)e.views[v].frames.splice(at,0,duplicate?copyFrame(e,v,Math.max(0,at-1)):blankFrame());
 e.frameCount++;return true;
}
export function deleteFrame(e,index){
 if(e.frameCount<=1)return false;
 for(const v of VIEWS)e.views[v].frames.splice(index,1);
 e.frameCount--;return true;
}
export function reorderFrames(e,a,b){
 if(a<0||b<0||a>=e.frameCount||b>=e.frameCount)return false;
 for(const v of VIEWS){const f=e.views[v].frames;[f[a],f[b]]=[f[b],f[a]];}
 return true;
}
export function drawEmotionFrame(ctx,emotion,view='front',index=0){
 if(!emotion||!VIEWS.includes(view))return;
 const place=emotion.placement?.[view]||{x:0,y:0,scale:1,enabled:true};
 if(place.enabled===false)return;
 const f=emotion.views?.[view]?.frames?.[index%emotion.frameCount];
 if(!f)return;
 ctx.save();ctx.translate(32+place.x,32+place.y);ctx.scale(place.scale,place.scale);ctx.translate(-32,-32);
 for(const [pos,col] of Object.entries(f.pixels)){const [x,y]=pos.split(',').map(Number);ctx.fillStyle=col;ctx.fillRect(x,y,1,1);}
 ctx.restore();
}
export function textToConvoTimeline(text,count=9){
 const phoneme={a:1,i:2,u:3,e:4,o:5,m:0,b:0,p:0,f:6,v:6,s:7,z:7,t:8,d:8,n:2,l:2};
 const out=[];for(const char of String(text||'').toLowerCase().slice(0,1000)){
  const pause=/[\s,.!?;:]/.test(char),shape=pause?0:(phoneme[char]??(/[a-z]/.test(char)?7:0));
  out.push({letter:char,frame:shape%Math.max(1,count),ticks:pause?3:2});
 }return out;
}
