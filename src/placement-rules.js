import {boxKind,round,snap,topOf} from './world.js';

// Surface rules are mandatory even when visual grid snapping is switched off.
// Terrain cells tile edge-to-edge; no entity can occupy a solid object volume.
export const SURFACE_BY_PRESET=Object.freeze({
 road:'asphalt','road-local':'asphalt','road-wide':'asphalt',
 sidewalk:'sidewalk',crosswalk:'crosswalk',grass:'grass',
 platform:'floor',bridge:'floor'
});
export const SURFACE_RULES=Object.freeze({
 tree:['grass'],
 character:['sidewalk','crosswalk'],
 vehicle:['asphalt','crosswalk'],
 building:['grass','floor'],
 prop:['grass','sidewalk','floor']
});
export const surfaceType=o=>SURFACE_BY_PRESET[o?.preset]||null;
export const isSurface=o=>!!surfaceType(o);
export const allowedSurfaces=o=>SURFACE_RULES[o.kind]||[];

const EPS=.015;
const near=(a,b,t=.001)=>Math.abs(a-b)<=t;
const rectDims=o=>{
 if(o.kind==='character')return [.62,.62];
 if(o.kind==='tree'){
  const d=Math.min(1.25,Math.max(.65,o.width*.31));
  return [d,d];
 }
 return [o.width,Math.max(o.depth,.03)];
};
const rectangle=(o,inset=0)=>{
 const [w,d]=rectDims(o),x=Math.max(.02,w/2-inset),z=Math.max(.02,d/2-inset);
 const r=(o.rotation||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
 return [[-x,-z],[x,-z],[x,z],[-x,z]].map(([a,b])=>[
  o.x+a*c+b*s,o.z-a*s+b*c
 ]);
};
const axes=poly=>{
 const results=[];
 for(let i=0;i<2;i++){
  const a=poly[i],b=poly[(i+1)%4],dx=b[0]-a[0],dz=b[1]-a[1];
  const len=Math.hypot(dx,dz)||1;
  results.push([-dz/len,dx/len]);
 }
 return results;
};
export function footprintIntersects(a,b){
 const pa=rectangle(a),pb=rectangle(b);
 for(const axis of [...axes(pa),...axes(pb)]){
  const proj=p=>p.map(q=>q[0]*axis[0]+q[1]*axis[1]);
  const va=proj(pa),vb=proj(pb);
  if(Math.max(...va)<=Math.min(...vb)+EPS || Math.max(...vb)<=Math.min(...va)+EPS)return false;
 }
 return true;
}
export function coversPoint(o,x,z){
 const r=-(o.rotation||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
 const dx=x-o.x,dz=z-o.z;
 const px=dx*c+dz*s,pz=-dx*s+dz*c;
 return Math.abs(px)<=o.width/2+.001&&Math.abs(pz)<=o.depth/2+.001;
}
function samplePoints(o){
 const [w,d]=rectDims(o);
 // Sample close to the footprint boundary, not exact edges: adjacent surfaces
 // are allowed to meet without numerical gaps.
 const inset=Math.min(.06,Math.min(w,d)*.12);
 return [[o.x,o.z],...rectangle(o,inset)];
}
function surfacesAt(x,z,existing,types,levelBase){
 return existing.filter(o=>isSurface(o)
  &&types.includes(surfaceType(o))
  &&coversPoint(o,x,z)
  &&(levelBase===null||Math.abs(o.y-levelBase)<.7)
 ).sort((a,b)=>topOf(b)-topOf(a));
}
function nearestSupportingSurfaces(candidate,existing,allowed,levelBase){
 const picked=[];
 for(const [x,z]of samplePoints(candidate)){
  const surface=surfacesAt(x,z,existing,allowed,levelBase)[0];
  if(!surface)return null;
  picked.push(surface);
 }
 const max=Math.max(...picked.map(topOf)),min=Math.min(...picked.map(topOf));
 if(max-min>.45)return null; // no unexpected floating / large step
 return {top:topOf(picked[0]),surfaces:picked}; // the center determines foot elevation
}
function edgeSnap(value,extent,grid){
 const half=extent/2;
 const offset=((half%grid)+grid)%grid;
 return round(Math.round((value-offset)/grid)*grid+offset);
}
export function snapObject(object,grid=1,enabled=true){
 const o={...object};
 if(!enabled)return o;
 const step=Math.max(.25,Number(grid)||1);
 // Terrain boundaries stay on the global cell lattice, including odd-size
 // tiles: a 3u tile on a 1u grid has its center at x=n+0.5.
 if(isSurface(o)){
  const r=((o.rotation||0)%180+180)%180;
  const swap=Math.abs(r-90)<1e-4;
  o.x=edgeSnap(o.x,swap?o.depth:o.width,step);
  o.z=edgeSnap(o.z,swap?o.width:o.depth,step);
 }else{
  const substep=Math.min(step,.5);
  o.x=snap(o.x,substep);
  o.z=snap(o.z,substep);
 }
 return o;
}
function intersectsVolume(a,b){
 return a.y < topOf(b)-EPS && topOf(a)>b.y+EPS && footprintIntersects(a,b);
}
const label=o=>o?.name||o?.preset||o?.kind||'object';
function violation(reason,object){return {ok:false,reason,object};}

/**
 * Validate placement, movement, resizing, rotation and simulation with the
 * exact same rules. The returned object contains the resolved support height.
 * An existing object is never mutated by this function.
 */
export function evaluatePlacement(input,objects,{grid=1,snapEnabled=true,ignoreId=null,levelBase=0}={}){
 let o=snapObject(input,grid,snapEnabled);
 const rest=objects.filter(other=>other.id!==ignoreId&&other.id!==o.id);
 const surface=surfaceType(o);
 if(surface){
  // Ground terrain is laid at its explicitly selected level; crosswalk is
  // a thin painted overlay sitting on and wholly covered by asphalt.
  if(surface==='crosswalk'){
   if((o.rotation%90+90)%90!==0)return violation('Zebra cross harus rotasi kelipatan 90°.',o);
   const under=nearestSupportingSurfaces(o,rest,['asphalt'],levelBase);
   if(!under)return violation('Zebra cross harus seluruhnya di atas aspal.',o);
   o.y=round(under.top+.006);
  }else{
   if((o.rotation%90+90)%90!==0)return violation('Land, aspal dan trotoar berotasi tiap 90°.',o);
   o.y=round(Number(levelBase) || 0);
  }
 }else{
  const allowed=allowedSurfaces(o);
  const match=nearestSupportingSurfaces(o,rest,allowed,levelBase);
  if(!match){
   const text={
    tree:'Pohon hanya boleh di GRASS / rumput.',
    vehicle:'Kendaraan hanya boleh di ASPHALT / zebra cross.',
    character:'NPC hanya boleh di SIDEWALK / zebra cross.',
    building:'Bangunan perlu GRASS atau PLATFORM / floor.',
    prop:'Prop perlu GRASS, SIDEWALK, atau PLATFORM.'
   }[o.kind]||'Permukaan untuk objek ini belum tersedia.';
   return violation(text,o);
  }
  o.y=round(match.top);
 }
 for(const other of rest){
  const otherSurface=surfaceType(other);
  // Painted crosswalk intentionally overlays its host asphalt. All other
  // footprint intersections on the same elevation are disallowed.
  if((surface==='crosswalk'&&otherSurface==='asphalt')
    ||(surface==='asphalt'&&otherSurface==='crosswalk'))continue;
  if(intersectsVolume(o,other)){
   return violation('Bertabrakan / menembus '+label(other)+'. Geser ke grid kosong.',o);
  }
 }
 return {ok:true,reason:'SNAP OK',object:o,surface:surface||'object'};
}
/**
 * A painted tile may support parked vehicles, trees, buildings or pedestrians.
 * Reject removing/replacing/moving it if a previously valid dependent becomes
 * unsupported. This prevents floating people and cars after editing a road.
 */
export function validateDependents(original,replacement,objects,grid=1){
 if(!isSurface(original))return {ok:true};
 const after=objects.filter(o=>o.id!==original.id);
 if(replacement)after.push(replacement);
 for(const o of objects){
  if(o.id===original.id||!footprintIntersects(o,original))continue;
  const levelBase=Math.floor(Math.max(0,o.y)/4)*4;
  const before=evaluatePlacement(o,objects,{grid,snapEnabled:false,ignoreId:o.id,levelBase});
  if(!before.ok)continue; // preserve older worlds without blocking unrelated edits
  const updated=evaluatePlacement(o,after,{grid,snapEnabled:false,ignoreId:o.id,levelBase});
  if(!updated.ok||Math.abs(updated.object.y-o.y)>.02)return {ok:false,reason:'Permukaan masih menopang '+label(o)+'. Geser objek di atasnya dahulu.'};
 }
 return {ok:true};
}
export function simulateStep(player,dx,dz,objects,{grid=1}={}){
 const candidate={...player,x:round(player.x+dx),z:round(player.z+dz)};
 return evaluatePlacement(candidate,objects,{grid,snapEnabled:false,ignoreId:player.id,levelBase:Math.floor(player.y/4)*4});
}
export function findPlayerSpawn(objects,grid=1){
 for(const s of objects.filter(o=>['sidewalk','crosswalk'].includes(surfaceType(o)))){
  const probes=[[s.x,s.z],...rectangle(s,.35)];
  for(const [x,z]of probes){
   const player={
    id:'laifu-player-simulation',preset:'character',kind:'character',
    name:'PLAYER (SIMULATION)',x,y:0,z,width:1,depth:.03,height:2,
    rotation:0,color:'#ffffff',alpha:1,textures:{},blocking:false
   };
   const r=evaluatePlacement(player,objects,{grid,snapEnabled:false,levelBase:Math.floor(s.y/4)*4});
   if(r.ok){r.object.x=x;r.object.z=z;return r.object;}
  }
 }
 return null;
}
