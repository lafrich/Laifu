import {FRAME,VIEWS,PARTS,PALETTE,LAIFU_SCALE} from './constants.js';
const key=(x,y)=>`${x},${y}`;
const partById=id=>PARTS.find(p=>p.id===id);
export function createPart(def){return {id:def.id,label:def.label,parent:def.parent,pivot:[...def.pivot],angle:0,offset:[0,0],visible:true,locked:false,z:def.z,pixels:{}};}
function rect(p,x0,y0,x1,y1,c){for(let y=Math.ceil(y0);y<=y1;y++)for(let x=Math.ceil(x0);x<=x1;x++){if(x>=0&&x<FRAME.width&&y>=0&&y<FRAME.height)p.pixels[key(x,y)]=c;}}
function ellipse(p,cx,cy,rx,ry,col){for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1&&x>=0&&x<FRAME.width&&y>=0&&y<FRAME.height)p.pixels[key(x,y)]=col;}}
export function createGenesis(){const views={};for(const view of VIEWS){const parts=PARTS.map(createPart);const p=Object.fromEntries(parts.map(p=>[p.id,p]));const skin='#d99b7a',light='#f4c6a6',shade='#9b614d',shirt='#46627a',dark='#24364c',trousers='#444866',shoe='#25273c';
 const profile=view==='left'||view==='right';const mid=32;
 ellipse(p.head,mid,31,profile?7:9,11,skin);rect(p.head,mid-5,37,mid+5,42,shade);ellipse(p.head,mid-3,27,3,6,light);
 rect(p.hair,profile?mid-7:mid-9,20,profile?mid+6:mid+8,25,dark);rect(p.hair,mid-8,24,mid-6,31,dark);if(view==='back')rect(p.hair,mid-8,26,mid+8,33,dark);
 if(view==='front'){rect(p.face,28,31,29,32,'#25273c');rect(p.face,35,31,36,32,'#25273c');rect(p.face,31,37,34,37,shade);}else if(profile){const ex=view==='right'?36:27;rect(p.face,ex,31,ex+1,32,dark);rect(p.face,view==='right'?37:26,35,view==='right'?38:27,36,shade);}
 rect(p.torso,24,43,40,67,shirt);rect(p.torso,26,44,28,65,'#6f9baa');rect(p.torso,37,44,40,67,dark);rect(p.torso,29,42,35,44,skin);
 rect(p.pelvis,25,67,39,76,trousers);rect(p.pelvis,27,68,37,69,shoe);
 for(const [side,X,DX] of [['L',20,-1],['R',44,1]]){
 rect(p['upperArm'+side],X-3,45,X+3,58,shirt);rect(p['upperArm'+side],X+DX*2,48,X+DX*3,56,dark);
 rect(p['forearm'+side],X+DX*2-2,59,X+DX*2+2,71,skin);
 rect(p['hand'+side],X+DX*2-2,70,X+DX*2+2,77,light);
 }
 rect(p.thighL,25,76,31,88,trousers);rect(p.thighR,33,76,39,88,trousers);
 rect(p.calfL,25,89,31,102,trousers);rect(p.calfR,33,89,39,102,trousers);
 rect(p.footL,23,102,32,107,shoe);rect(p.footR,32,102,42,107,shoe);
 if(profile){ // side silhouette still contains editable, separate layers
   rect(p.torso,24,43,27,65,'#24364c');
   if(view==='left')rect(p.face,26,36,27,37,shade);
 }
 views[view]={parts};
 }
 return {format:'laifu.character.v1',name:'Genesis 01',genesis:'male',frame:{...FRAME},scale:{...LAIFU_SCALE},views,animations:{idle:[{frame:0,angles:{}}],walk:[{frame:0,angles:{thighL:19,thighR:-19,calfL:8,calfR:0,upperArmL:-14,upperArmR:14}},{frame:6,angles:{thighL:-19,thighR:19,calfL:0,calfR:8,upperArmL:14,upperArmR:-14}},{frame:12,angles:{thighL:19,thighR:-19,calfL:8,calfR:0,upperArmL:-14,upperArmR:14}}],sit:[{frame:0,angles:{thighL:-75,thighR:-75,calfL:85,calfR:85}}]},fps:12};
}
export function normalizeCharacter(data){if(!data||data.format!=='laifu.character.v1')throw new Error('Format karakter bukan laifu.character.v1');if(!['male','female'].includes(data.genesis))throw new Error('Genesis harus male atau female');if(data.frame?.width!==64||data.frame?.height!==112)throw new Error('Frame karakter harus 64×112');const oldScale=data.scale?.doorUnits===1&&data.scale?.characterHeight===1&&data.scale?.levelHeight===2&&data.scale?.minBuildingHeight===2;
 if(oldScale)data.scale={...LAIFU_SCALE}; // migrate older world-unit exports (same physical 1:1:2 proportion)
 if(data.scale?.doorUnits!==2||data.scale?.characterHeight!==2||data.scale?.levelHeight!==4||data.scale?.minBuildingHeight!==4)throw new Error('Skala Laifu tidak valid: door=2, character=2, level=4, minBuilding=4');for(const v of VIEWS){if(!Array.isArray(data.views?.[v]?.parts))throw new Error('View '+v+' tidak ada');for(const p of data.views[v].parts){if(!PARTS.some(def=>def.id===p.id))throw new Error('Part tidak dikenal: '+p.id);if(typeof p.pixels!=='object'||!Array.isArray(p.pivot)||!Array.isArray(p.offset))throw new Error('Data part rusak');}}return data;}
export function getPart(character,view,id){return character.views[view].parts.find(p=>p.id===id);}
export function putPixel(part,x,y,color){x=Math.floor(x);y=Math.floor(y);if(x<0||x>=FRAME.width||y<0||y>=FRAME.height)return false;const k=key(x,y);if(color){if(part.pixels[k]===color)return false;part.pixels[k]=color;}else{if(!(k in part.pixels))return false;delete part.pixels[k];}return true;}
export function fillPixel(part,x,y,color){const target=part.pixels[key(x,y)]||null;if(target===color)return;const seen=new Set(),stack=[[x,y]];while(stack.length){const [xx,yy]=stack.pop(),k=key(xx,yy);if(xx<0||xx>=64||yy<0||yy>=112||seen.has(k))continue;seen.add(k);if((part.pixels[k]||null)!==target)continue;putPixel(part,xx,yy,color);stack.push([xx-1,yy],[xx+1,yy],[xx,yy-1],[xx,yy+1]);}}
export function shiftPixels(part,dx,dy){const next={};for(const [k,c] of Object.entries(part.pixels)){const [x,y]=k.split(',').map(Number);const nx=x+dx,ny=y+dy;if(nx>=0&&nx<64&&ny>=0&&ny<112)next[key(nx,ny)]=c;}part.pixels=next;part.pivot=[part.pivot[0]+dx,part.pivot[1]+dy];}
export function flipPixels(part){const px=part.pivot[0],next={};for(const [k,c]of Object.entries(part.pixels)){const [x,y]=k.split(',').map(Number),nx=2*px-x;if(nx>=0&&nx<64)next[key(nx,y)]=c;}part.pixels=next;}
export function sampleAngles(animation,frame){if(!animation?.length)return {};const sorted=[...animation].sort((a,b)=>a.frame-b.frame);if(sorted.length===1)return {...sorted[0].angles};const max=sorted[sorted.length-1].frame||1;const f=((frame%max)+max)%max;let a=sorted[0],b=sorted[sorted.length-1];for(let i=0;i<sorted.length-1;i++){if(f>=sorted[i].frame&&f<=sorted[i+1].frame){a=sorted[i];b=sorted[i+1];break;}}const t=a===b?0:(f-a.frame)/(b.frame-a.frame||1);const out={};for(const k of new Set([...Object.keys(a.angles),...Object.keys(b.angles)]))out[k]=(a.angles[k]||0)*(1-t)+(b.angles[k]||0)*t;return out;}
export const references={partById,PALETTE};
