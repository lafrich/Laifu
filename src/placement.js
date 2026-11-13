import {snap,round,topOf} from './world.js';
/** All footprints are measured in world X/Z, and rotated around Y. */
export const surfaceType=o=>{
 if(['road','road-local','road-wide'].includes(o.preset))return 'asphalt';
 if(o.preset==='sidewalk')return 'sidewalk';
 if(o.preset==='zebra')return 'zebra';
 if(['grass','grass-large'].includes(o.preset))return 'grass';
 return null;
};
export const isGroundTile=o=>!!surfaceType(o);
export const snapCenter=(n,size,grid=1)=>round(snap(n-size/2,grid)+size/2);
export function corners(o){
 const a=(o.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=o.width/2,z=o.depth/2;
 return [[-x,-z],[x,-z],[x,z],[-x,z]].map(([u,v])=>[o.x+u*c+v*s,o.z-u*s+v*c]);
}
export function containsFootprint(tile,o,epsilon=.001){
 const [a,b,d]=[tile.x,tile.z,(tile.rotation||0)*Math.PI/180];
 const c=Math.cos(d),s=Math.sin(d);
 return corners(o).every(([x,z])=>{
  const dx=x-a,dz=z-b,localX=dx*c-dz*s,localZ=dx*s+dz*c;
  return Math.abs(localX)<=tile.width/2+epsilon&&Math.abs(localZ)<=tile.depth/2+epsilon;
 });
}
export function overlapXZ(a,b,eps=.001){
 const A=corners(a),B=corners(b),axes=[];
 for(const points of [A,B])for(let i=0;i<2;i++){const p=points[i],q=points[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz)||1;axes.push([-dz/len,dx/len]);}
 for(const [ax,az] of axes){
  const p=A.map(([x,z])=>x*ax+z*az),q=B.map(([x,z])=>x*ax+z*az);
  if(Math.max(...p)<=Math.min(...q)+eps||Math.max(...q)<=Math.min(...p)+eps)return false;
 }
 return true;
}
function occupancyHeight(o){return [o.y,topOf(o)];}
export function validatePlacement(o,others,ignoreId=null){
 const type=surfaceType(o);
 // Terrain tiles are unique occupied patches, not stackable transparent planes.
 if(type){
  for(const p of others){if(p.id===ignoreId||!isGroundTile(p))continue;
   if(Math.abs(o.y-p.y)<.1&&overlapXZ(o,p))return {ok:false,reason:'Terrain bertabrakan: grid tanah/aspal/trotoar tidak boleh tumpang tindih'};
  }
  for(const p of others){if(p.id===ignoreId||isGroundTile(p))continue;
   if(overlapXZ(o,p)&&o.y<topOf(p)-.001&&topOf(o)>p.y+.001)return {ok:false,reason:'Terrain menembus objek'};
  }
  return {ok:true};
 }
 const accepted=o.kind==='tree'?['grass']:o.kind==='vehicle'?['asphalt']:o.kind==='character'?['sidewalk','zebra']:null;
 let surface=null;
 if(accepted){
  surface=others.find(p=>p.id!==ignoreId&&accepted.includes(surfaceType(p))&&containsFootprint(p,o)&&Math.abs(topOf(p)-o.y)<.03);
  if(!surface)return {ok:false,reason:o.kind==='tree'?'Pohon hanya boleh di area rumput':o.kind==='vehicle'?'Kendaraan harus seluruhnya di atas aspal':'NPC hanya boleh di trotoar atau zebra cross'};
 }else{
  // General props/buildings must not tunnel through road, zebra or sidewalk.
  for(const p of others)if(p.id!==ignoreId&&isGroundTile(p)&&overlapXZ(o,p)&&o.y<topOf(p)-.01&&topOf(o)>p.y+.01)return {ok:false,reason:'Objek menembus permukaan terrain'};
 }
 for(const p of others){if(p.id===ignoreId||isGroundTile(p))continue;
  if(!overlapXZ(o,p))continue;
  const [y0,y1]=occupancyHeight(o),[p0,p1]=occupancyHeight(p);
  if(y0<p1-.01&&p0<y1-.01)return {ok:false,reason:'Placement ditolak: objek saling menembus'};
 }
 return {ok:true,surface};
}
export function resolvePlacement(candidate,others,grid=1,ignoreId=null){
 const o={...candidate};
 // Snap every object to the cell edge to keep asphalt/sidewalk modules aligned.
 // Rotated 90-degree footprints swap dimensions for precise grid edges.
 const axis=((Math.round((o.rotation||0)/90)%2)+2)%2;
 const w=axis?o.depth:o.width,d=axis?o.width:o.depth;
 o.x=snapCenter(o.x,w,grid);o.z=snapCenter(o.z,d,grid);
 const type=surfaceType(o);
 const needed=o.kind==='tree'?['grass']:o.kind==='vehicle'?['asphalt']:o.kind==='character'?['sidewalk','zebra']:null;
 if(needed){
  const supports=others.filter(p=>p.id!==ignoreId&&needed.includes(surfaceType(p))&&containsFootprint(p,o));
  const support=supports.find(p=>Math.abs(topOf(p)-o.y)<.5)||supports.sort((a,b)=>topOf(b)-topOf(a))[0];
  if(support)o.y=topOf(support);
 }
 const checked=validatePlacement(o,others,ignoreId);
 return {...checked,object:o};
}
export function surfaceAtXZ(x,z,others,types=['sidewalk','zebra']){
 const tiny={x,z,width:.1,depth:.1,rotation:0};
 return others.filter(p=>types.includes(surfaceType(p))&&containsFootprint(p,tiny)).sort((a,b)=>topOf(b)-topOf(a))[0]||null;
}
