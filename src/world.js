import {clamp, hitEntity, intersectPlane} from './math.js';

/** Laifu is a clean-room 3D project. All measurements are real world Y-up units.
 * A door / character is 2u tall. A level is two stacked doors (4u).
 * A building is never shorter than one level (4u).
 */
export const SCHEMA = 'laifu.world.v1';
export const DOOR_HEIGHT = 2;
export const CHARACTER_HEIGHT = DOOR_HEIGHT;
export const LEVEL_STEP = DOOR_HEIGHT * 2;
export const MIN_BUILDING_HEIGHT = LEVEL_STEP;
export const MAX_LEVEL = 20;
export const HEIGHT_MIN = -32;
export const HEIGHT_MAX = 160;
export const MAX_OBJECTS = 2000;

export const PRESETS = [
 {id:"road",label:"ROAD / ASPHALT",category:"Terrain",kind:"road",width:8,depth:4,height:0.24,color:"#566470",description:"Two-lane road slab, with real thickness"},
 {id:"road-local",label:"ROAD / NARROW",category:"Terrain",kind:"road",width:4,depth:8,height:0.24,color:"#62717c",description:"Narrow local street segment"},
 {id:"road-wide",label:"ROAD / WIDE",category:"Terrain",kind:"road",width:12,depth:8,height:0.24,color:"#475866",description:"Wide road / city boulevard"},
 {id:"grass",label:"GRASS / PLOT",category:"Terrain",kind:"road",width:8,depth:8,height:0.15,color:"#7da769",description:"Planting ground · trees only here"},
 {id:"grass-large",label:"GRASS / LARGE PLOT",category:"Terrain",kind:"road",width:12,depth:12,height:0.15,color:"#7da769",description:"Large plantable ground"},
 {id:"zebra",label:"ZEBRA CROSS / WALKWAY",category:"Terrain",kind:"road",width:4,depth:2,height:0.25,color:"#e4e7e3",description:"Pedestrian crossing · NPCs can stand here"},
 {id:"sidewalk",label:"SIDEWALK",category:"Terrain",kind:"road",width:8,depth:2,height:0.42,color:"#c1bdaf",description:"Pedestrian slab with raised curb"},
 {id:"platform",label:"PLATFORM / FLOOR",category:"Terrain",kind:"platform",width:8,depth:8,height:0.35,color:"#97abb6",description:"Raised solid floor, stackable surface"},
 {id:"bridge",label:"BRIDGE / SLAB",category:"Terrain",kind:"platform",width:12,depth:5,height:0.6,color:"#8d969f",description:"Elevated road or walkable slab"},
 {id:"kiosk",label:"BUILDING / KIOSK",category:"Buildings",kind:"building",width:3,depth:3,height:4,color:"#ddb594",description:"Smallest building: 2 doors = 4u"},
 {id:"house",label:"HOUSE / MINIMUM",category:"Buildings",kind:"building",width:4,depth:5,height:4,color:"#deb89e",description:"Small home · 1 level / 2 doors high"},
 {id:"shop",label:"SHOP / WARUNG BOX",category:"Buildings",kind:"building",width:5,depth:7,height:4,color:"#d1bba3",description:"Shop footprint · minimum 4u tall"},
 {id:"warehouse",label:"WAREHOUSE",category:"Buildings",kind:"building",width:10,depth:12,height:4,color:"#b5c3c7",description:"Single level, wide footprint"},
 {id:"block",label:"BUILDING / MEDIUM",category:"Buildings",kind:"building",width:6,depth:6,height:8,color:"#b7cadd",description:"2 levels / 4 doors high"},
 {id:"school",label:"SCHOOL / MEDIUM",category:"Buildings",kind:"building",width:10,depth:7,height:8,color:"#d6c7a4",description:"Medium building · 2 levels"},
 {id:"office",label:"OFFICE / LARGE",category:"Buildings",kind:"building",width:8,depth:8,height:12,color:"#a7bdcf",description:"3 levels / 6 doors high"},
 {id:"tower",label:"TOWER / TALL",category:"Buildings",kind:"building",width:7,depth:7,height:16,color:"#b3b1cf",description:"4 levels / 8 doors high"},
 {id:"apartment",label:"APARTMENT / HIGHRISE",category:"Buildings",kind:"building",width:10,depth:10,height:20,color:"#c4bdce",description:"5 levels / 10 doors high"},
 {id:"motorcycle",label:"MOTORCYCLE / BOX",category:"Vehicles",kind:"vehicle",width:0.9,depth:2,height:1.3,color:"#d2a968",description:"Compact vehicle placeholder"},
 {id:"vehicle",label:"CAR / BOX",category:"Vehicles",kind:"vehicle",width:2,depth:4,height:1.8,color:"#e4ba66",description:"Six editable sides · real 3D box"},
 {id:"van",label:"VAN / BOX",category:"Vehicles",kind:"vehicle",width:2.4,depth:5.4,height:2.5,color:"#d2ad8f",description:"Tall van placeholder"},
 {id:"bus",label:"BUS / BOX",category:"Vehicles",kind:"vehicle",width:2.6,depth:8,height:3,color:"#75b5c7",description:"Large bus · six-sided box"},
 {id:"truck",label:"TRUCK / BOX",category:"Vehicles",kind:"vehicle",width:2.7,depth:8,height:3.2,color:"#adbbb1",description:"Large transport placeholder"},
 {id:"tree-small",label:"TREE / SMALL PLANE",category:"Planes",kind:"tree",width:2,depth:0.03,height:3.5,color:"#8daf88",description:"Camera-facing vegetation plane"},
 {id:"tree",label:"TREE / MEDIUM PLANE",category:"Planes",kind:"tree",width:3,depth:0.03,height:6,color:"#70a988",description:"Camera-facing vegetation plane"},
 {id:"tree-large",label:"TREE / LARGE PLANE",category:"Planes",kind:"tree",width:5,depth:0.03,height:10,color:"#5f9878",description:"Tall vegetation plane"},
 {id:"character",label:"CHARACTER / PLANE",category:"Planes",kind:"character",width:1,depth:0.03,height:2,color:"#d19d8e",description:"1 door = 2u · world-facing character plane"},
 {id:"prop",label:"PROP / BOX",category:"Props",kind:"prop",width:1.5,depth:1.5,height:1.5,color:"#afb3c0",description:"Generic editable solid cuboid"},
 {id:"bench",label:"BENCH / BOX",category:"Props",kind:"prop",width:2,depth:0.8,height:0.9,color:"#ad9579",description:"Small street or park furniture"},
 {id:"lamp",label:"STREET LAMP / BOX",category:"Props",kind:"prop",width:0.5,depth:0.5,height:5,color:"#899da8",description:"Tall utility placeholder"},
 {id:"wall",label:"WALL / BOX",category:"Props",kind:"prop",width:4,depth:0.3,height:4,color:"#c7c5bc",description:"Solid vertical wall slab"},
];
export const templates=Object.fromEntries(PRESETS.map(p=>[p.id,p]));
export const finite=(n,d=0)=>n===null||n===''||!Number.isFinite(Number(n))?d:Number(n);
export const round=n=>Math.round(n*1000)/1000;
export const snap=(n,s=1)=>round(Math.round(n/s)*s);
export const boxKind=kind=>!['tree','character'].includes(kind);
export const uid=()=>globalThis.crypto?.randomUUID?.() || `laifu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
export const levelY=n=>clamp(Math.round(finite(n)),0,MAX_LEVEL)*LEVEL_STEP;
export const topOf=o=>round(o.y+o.height);
export const minHeight=kind=>kind==='building'?MIN_BUILDING_HEIGHT:.04;

export function makeObject(id,x=0,z=0,y=0){
 const p=templates[id]||templates.prop;
 return {id:uid(),preset:p.id,kind:p.kind,name:p.label.replace(' / ',' · '),
  x:round(x),y:round(y),z:round(z),width:p.width,depth:p.depth,height:p.height,
  rotation:0,color:p.color,alpha:1,levelMode:'land',level:0,lock:false,
  textures:{},tags:[],actions:[],blocking:!['tree','character'].includes(p.kind),notes:''};
}
const newBase=()=>({schema:SCHEMA,version:1,title:'New Laifu World',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),grid:1,objects:[]});
export function newWorld(demo=true){
 const w=newBase();if(!demo)return w;
 w.title='Laifu / First City';
 const add=(preset,x,z,y=0,props={})=>{
  const o=makeObject(preset,x,z,y);Object.assign(o,props);w.objects.push(o);return o;
 };
 // 8x8 road modules meet on shared GRID edges (never overlap).
 for(const z of [-8,0,8]){
  add('road',0,z,0,{width:8,depth:8});
  add('sidewalk',-5,z,0,{width:2,depth:8});
  add('sidewalk',5,z,0,{width:2,depth:8});
 }
 // Crossing markings intentionally sit ON asphalt, not underneath it.
 add('zebra',0,0,.24,{width:8,depth:2});
 add('grass',-10,4,0,{width:8,depth:8});
 add('grass',10,12,0,{width:8,depth:8});
 add('tree',-10,5,.15);
 add('tree',10,12,.15);
 add('character',-5,2,.42);
 add('bus',0,-7,.24);
 add('house',-15,-8);
 add('block',15,-8);
 const raised=add('platform',-14,15,levelY(2));raised.levelMode='level';raised.level=2;
 const house=add('house',-14,15,levelY(2)+.35);house.levelMode='surface';
 return w;
}
export function validateObject(input){
 if(!input || typeof input!=='object')return null;
 const p=templates[String(input.preset)] || templates.prop;
 const o=makeObject(p.id);
 o.kind=p.kind;
 o.id=typeof input.id==='string'&&input.id.length<=100?input.id:uid();
 o.name=String(input.name??p.label).slice(0,100);
 for(const axis of ['x','y','z'])o[axis]=round(clamp(finite(input[axis]),-500,500));
 for(const dim of ['width','height','depth'])o[dim]=round(clamp(finite(input[dim],p[dim]),dim==='height'?minHeight(p.kind):.03,150));
 if(p.kind==='character')o.height=CHARACTER_HEIGHT;
 o.rotation=round(((finite(input.rotation)%360)+360)%360);
 o.color=/^#[a-f\d]{6}$/i.test(input.color)?input.color:p.color;
 o.alpha=clamp(finite(input.alpha,1),.15,1);
 o.levelMode=['land','level','surface','custom'].includes(input.levelMode)?input.levelMode:'custom';
 o.level=clamp(Math.round(finite(input.level)),0,MAX_LEVEL);
 o.lock=!!input.lock;
 o.blocking=input.blocking!==false;
 o.tags=Array.isArray(input.tags)?input.tags.map(x=>String(x).slice(0,80)).slice(0,20):[];
 o.actions=Array.isArray(input.actions)?input.actions.map(x=>String(x).slice(0,80)).slice(0,20):[];
 o.notes=String(input.notes??'').slice(0,2000);
 o.textures={};
 if(input.textures&&typeof input.textures==='object')for(const face of ['front','back','left','right','top','bottom','plane']){
  const val=input.textures[face];
  if(typeof val==='string'&&val.length<2500000&&(/^(data:image\/(png|jpeg|webp);base64,|\.\/?[\w/.-]+$|https?:\/\/)/i.test(val)))o.textures[face]=val;
 }
 return o;
}
export function parseWorld(value){
 const data=typeof value==='string'?JSON.parse(value):value;
 if(!data||data.schema!==SCHEMA||!Array.isArray(data.objects))throw Error('World JSON bukan format laifu.world.v1');
 if(data.objects.length>MAX_OBJECTS)throw Error(`Maksimal ${MAX_OBJECTS} objek`);
 const w=newBase();w.title=String(data.title||'Imported Laifu World').slice(0,100);
 w.grid=clamp(finite(data.grid,1),.25,8);w.createdAt=String(data.createdAt||w.createdAt);
 w.objects=data.objects.map(validateObject).filter(Boolean);
 const ids=new Set();for(const o of w.objects){if(ids.has(o.id))o.id=uid();ids.add(o.id);}
 return w;
}
export function serializeWorld(world){return JSON.stringify({...world,schema:SCHEMA,updatedAt:new Date().toISOString()},null,2);}
/** Raycast candidate stacking tops, plus ground. Ignore nonstructural planes and roads
 * by default; roads are eligible so vehicles can snap to the asphalt surface.
 */
export function surfaceAt(ray,objects,ignoreId=null){
 const hits=[];const ground=intersectPlane(ray,0);if(ground)hits.push({...ground,supportId:null});
 for(const o of objects){
  if(o.id===ignoreId||!boxKind(o.kind))continue;
  const hit=intersectPlane(ray,topOf(o));if(!hit)continue;
  const x=hit.x-o.x,z=hit.z-o.z,a=-(o.rotation||0)*Math.PI/180;
  const xr=x*Math.cos(a)+z*Math.sin(a),zr=-x*Math.sin(a)+z*Math.cos(a);
  if(Math.abs(xr)<=o.width/2 && Math.abs(zr)<=o.depth/2)hits.push({...hit,supportId:o.id});
 }
 hits.sort((a,b)=>a.t-b.t);return hits[0]||null;
}
export function heightForPlacement(mode,customY,ray,objects,ignoreId){
 if(mode==='land')return {y:0,mode:'land',level:0};
 if(mode==='custom')return {y:clamp(finite(customY),HEIGHT_MIN,HEIGHT_MAX),mode:'custom',level:0};
 if(mode==='surface'){
  const h=surfaceAt(ray,objects,ignoreId);
  return {y:h?.y??0,mode:h?.supportId?'surface':'land',level:0};
 }
 const match=/^level:(\d+)$/.exec(mode);
 if(match){const level=clamp(+match[1],0,MAX_LEVEL);return {y:levelY(level),mode:'level',level};}
 return {y:0,mode:'land',level:0};
}
export function pickEntity(ray,objects,billboardYaw=0){
 let closest=null;
 for(const o of objects){
  const adjusted=o.kind==='tree'?{...o,rotation:billboardYaw*180/Math.PI}:o;
  const distance=hitEntity(ray,adjusted);
  if(distance!==null&&(closest===null||distance<closest.distance))closest={entity:o,distance};
 }
 return closest;
}
