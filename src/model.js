import {FRAME,VIEWS,PARTS,PALETTE,LAIFU_SCALE} from './constants.js';
import {SKIN_TOKENS,DEFAULT_SKIN_KEY,normalizeSkinKey,convertLegacySkinPixels} from './skin.js';
const key=(x,y)=>`${x},${y}`;
const partById=id=>PARTS.find(p=>p.id===id);
export function createPart(def){return {id:def.id,label:def.label,parent:def.parent,pivot:[...def.pivot],angle:0,offset:[0,0],visible:true,locked:false,z:def.z,pixels:{}};}
function rect(p,x0,y0,x1,y1,c){for(let y=Math.ceil(y0);y<=y1;y++)for(let x=Math.ceil(x0);x<=x1;x++){if(x>=0&&x<FRAME.width&&y>=0&&y<FRAME.height)p.pixels[key(x,y)]=c;}}
function ellipse(p,cx,cy,rx,ry,col){for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1&&x>=0&&x<FRAME.width&&y>=0&&y<FRAME.height)p.pixels[key(x,y)]=col;}}

/**
 * Author a genuine 2D anatomical profile for Genesis. It is NOT an x-flipped
 * front sprite: hips, chest, head profile, limbs, feet, pivots and z-order
 * are redrawn for the side silhouette. Each direction remains independently
 * editable after template creation. Changing the template never changes an
 * imported/exported character document.
 */
function drawSideProfile(p,view){
 const skin=SKIN_TOKENS.base,light=SKIN_TOKENS.light,shade=SKIN_TOKENS.shadow;
 const shirt='#46627a',highlight='#6f9baa',dark='#24364c';
 const trousers='#444866',shoe='#25273c';
 const near=view==='right'?'R':'L',far=view==='right'?'L':'R';
 const rig=(id,x,y,z)=>{p[id].pivot=[x,y];p[id].z=z;};
 // Absolute pivot coordinates are specific to this direction, not front-view.
 rig('pelvis',33,70,4);rig('torso',33,65,6);
 rig('head',32,41,8);
 rig('thigh'+far,31,75,2);rig('calf'+far,31,89,2);rig('foot'+far,31,102,2);
 rig('thigh'+near,35,75,3);rig('calf'+near,35,89,3);rig('foot'+near,35,102,4);
 rig('upperArm'+far,31,48,5);rig('forearm'+far,31,59,5);rig('hand'+far,31,70,5);
 rig('upperArm'+near,36,47,7);rig('forearm'+near,36,59,7);rig('hand'+near,36,70,7);
 // Facing right (+X). Facing left is an exact 64px mirror applied below.
 ellipse(p.head,32,31,7,10,skin);
 rect(p.head,39,33,41,36,skin); // nose profile
 rect(p.head,29,39,34,44,shade); // neck joins torso
 ellipse(p.head,34,27,3,5,light);
 // Face features and hairstyle are assigned by Laifu Emosi / future Hair editor.
 rect(p.torso,28,44,38,66,shirt); // 11px profile vs 17px front
 rect(p.torso,37,48,40,54,shirt); // chest protrudes forward
 rect(p.torso,28,46,29,64,dark); // back shadow
 rect(p.torso,36,47,37,60,highlight);
 rect(p.torso,30,42,35,45,skin);
 rect(p.pelvis,29,67,37,76,trousers);
 rect(p.pelvis,29,68,31,74,shoe);
 // The far limbs are visibly behind the body, not spread like front view.
 rect(p['upperArm'+far],28,47,32,59,dark);
 rect(p['forearm'+far],29,59,33,69,shade);
 rect(p['hand'+far],29,69,33,75,skin);
 rect(p['upperArm'+near],34,46,39,59,shirt);
 rect(p['upperArm'+near],37,49,39,56,dark);
 rect(p['forearm'+near],34,59,39,70,skin);
 rect(p['hand'+near],35,70,39,77,light);
 rect(p['thigh'+far],29,75,34,89,trousers);
 rect(p['calf'+far],29,89,34,102,trousers);
 rect(p['foot'+far],28,102,40,105,shoe);
 rect(p['thigh'+near],33,76,38,89,trousers);
 rect(p['thigh'+near],36,78,38,86,shoe);
 rect(p['calf'+near],33,89,38,102,trousers);
 rect(p['foot'+near],32,102,45,107,shoe); // toes point forward
 rect(p['foot'+near],34,102,39,103,trousers);
 if(view==='left'){
   // Mirroring applies to both pixels and pivot; bone positions therefore
   // follow each directional silhouette and are not inherited from front.
   for(const part of Object.values(p)){
     const mirrored={};
     for(const [coord,color] of Object.entries(part.pixels)){
       const [x,y]=coord.split(',').map(Number);
       mirrored[key(FRAME.width-1-x,y)]=color;
     }
     part.pixels=mirrored;
     part.pivot[0]=FRAME.width-1-part.pivot[0];
   }
 }
}

export function createGenesis(){const views={};for(const view of VIEWS){const parts=PARTS.map(createPart);const p=Object.fromEntries(parts.map(p=>[p.id,p]));const skin=SKIN_TOKENS.base,light=SKIN_TOKENS.light,shade=SKIN_TOKENS.shadow,shirt='#46627a',dark='#24364c',trousers='#444866',shoe='#25273c';
 const profile=view==='left'||view==='right';const mid=32;
 if(profile){drawSideProfile(p,view);views[view]={parts};continue;}
 ellipse(p.head,mid,31,profile?7:9,11,skin);rect(p.head,mid-5,37,mid+5,42,shade);ellipse(p.head,mid-3,27,3,6,light);
 // Base head is deliberately bald and faceless. Face/hair are separate assets.
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
 views[view]={parts};
 }
 return {format:'laifu.character.v1',name:'Genesis 01',genesis:'male',skinKey:{...DEFAULT_SKIN_KEY},faceRef:null,appearance:{source:'separate-emotion-overlay'},frame:{...FRAME},scale:{...LAIFU_SCALE},views,animations:{idle:[{frame:0,angles:{}}],walk:[{frame:0,angles:{thighL:19,thighR:-19,calfL:8,calfR:0,upperArmL:-14,upperArmR:14}},{frame:6,angles:{thighL:-19,thighR:19,calfL:0,calfR:8,upperArmL:14,upperArmR:-14}},{frame:12,angles:{thighL:19,thighR:-19,calfL:8,calfR:0,upperArmL:-14,upperArmR:14}}],sit:[{frame:0,angles:{thighL:-75,thighR:-75,calfL:85,calfR:85}}]},fps:12};
}
export function normalizeCharacter(data){
 if(!data||data.format!=='laifu.character.v1')throw new Error('Format karakter bukan laifu.character.v1');
 if(!['male','female'].includes(data.genesis))throw new Error('Genesis harus male atau female');
 if(data.frame?.width!==64||data.frame?.height!==112)throw new Error('Frame karakter harus 64×112');
 const oldScale=data.scale?.doorUnits===1&&data.scale?.characterHeight===1&&data.scale?.levelHeight===2&&data.scale?.minBuildingHeight===2;
 if(oldScale)data.scale={...LAIFU_SCALE};
 if(data.scale?.doorUnits!==2||data.scale?.characterHeight!==2||data.scale?.levelHeight!==4||data.scale?.minBuildingHeight!==4)throw new Error('Skala Laifu tidak valid: door=2, character=2, level=4, minBuilding=4');
 // Old exports may still contain separate hair and face artwork. Keep its bytes
 // in a detached, non-rendered backup instead of silently throwing away art.
 const backup=data.appearance?.legacyDetachedLayers||{};
 for(const v of VIEWS){
  if(!Array.isArray(data.views?.[v]?.parts))throw new Error('View '+v+' tidak ada');
  const parts=data.views[v].parts;
  const detached=parts.filter(p=>p?.id==='face'||p?.id==='hair');
  if(detached.length && !backup[v])backup[v]=structuredClone(detached);
  data.views[v].parts=parts.filter(p=>p?.id!=='face'&&p?.id!=='hair');
  for(const p of data.views[v].parts){
   if(!PARTS.some(def=>def.id===p.id))throw new Error('Part tidak dikenal: '+p.id);
   if(!p.pixels||typeof p.pixels!=='object'||!Array.isArray(p.pivot)||!Array.isArray(p.offset))throw new Error('Data part rusak');
  }
  const ids=new Set(data.views[v].parts.map(p=>p.id));
  for(const def of PARTS)if(!ids.has(def.id))data.views[v].parts.push(createPart(def));
 }
 data.appearance={...(data.appearance||{}),source:'separate-emotion-overlay'};
 if(Object.keys(backup).length)data.appearance.legacyDetachedLayers=backup;
 data.skinKey=normalizeSkinKey(data.skinKey||DEFAULT_SKIN_KEY);
 // Existing hardcoded skin shades are upgraded to color slots in every view.
 convertLegacySkinPixels(data);
 if(!('faceRef' in data))data.faceRef=null;
 return data;
}
export function getPart(character,view,id){return character.views[view].parts.find(p=>p.id===id);}
export function putPixel(part,x,y,color){x=Math.floor(x);y=Math.floor(y);if(x<0||x>=FRAME.width||y<0||y>=FRAME.height)return false;const k=key(x,y);if(color){if(part.pixels[k]===color)return false;part.pixels[k]=color;}else{if(!(k in part.pixels))return false;delete part.pixels[k];}return true;}
export function fillPixel(part,x,y,color){const target=part.pixels[key(x,y)]||null;if(target===color)return;const seen=new Set(),stack=[[x,y]];while(stack.length){const [xx,yy]=stack.pop(),k=key(xx,yy);if(xx<0||xx>=64||yy<0||yy>=112||seen.has(k))continue;seen.add(k);if((part.pixels[k]||null)!==target)continue;putPixel(part,xx,yy,color);stack.push([xx-1,yy],[xx+1,yy],[xx,yy-1],[xx,yy+1]);}}
export function shiftPixels(part,dx,dy){const next={};for(const [k,c] of Object.entries(part.pixels)){const [x,y]=k.split(',').map(Number);const nx=x+dx,ny=y+dy;if(nx>=0&&nx<64&&ny>=0&&ny<112)next[key(nx,ny)]=c;}part.pixels=next;part.pivot=[part.pivot[0]+dx,part.pivot[1]+dy];}
export function flipPixels(part){const px=part.pivot[0],next={};for(const [k,c]of Object.entries(part.pixels)){const [x,y]=k.split(',').map(Number),nx=2*px-x;if(nx>=0&&nx<64)next[key(nx,y)]=c;}part.pixels=next;}
export function sampleAngles(animation,frame){if(!animation?.length)return {};const sorted=[...animation].sort((a,b)=>a.frame-b.frame);if(sorted.length===1)return {...sorted[0].angles};const max=sorted[sorted.length-1].frame||1;const f=((frame%max)+max)%max;let a=sorted[0],b=sorted[sorted.length-1];for(let i=0;i<sorted.length-1;i++){if(f>=sorted[i].frame&&f<=sorted[i+1].frame){a=sorted[i];b=sorted[i+1];break;}}const t=a===b?0:(f-a.frame)/(b.frame-a.frame||1);const out={};for(const k of new Set([...Object.keys(a.angles),...Object.keys(b.angles)]))out[k]=(a.angles[k]||0)*(1-t)+(b.angles[k]||0)*t;return out;}
export const references={partById,PALETTE};
