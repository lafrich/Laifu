import {surfaceType} from './placement-rules.js';
import {round,topOf} from './world.js';

export const GRID_MIN=.25;
export const GRID_MAX=4;
export const gridStep=value=>Math.min(GRID_MAX,Math.max(GRID_MIN,Number(value)||1));

/**
 * Terrain-specific gridlines are drawn just ABOVE the tile's top surface.
 * A global grid below the landscape was invisible and could not guide snapping.
 * All tile boundaries and internal lines use the same local, edge-aligned lattice.
 */
export function surfaceGridSegments(object,requestedStep=1){
 if(!surfaceType(object))return [];
 const step=gridStep(requestedStep);
 const a=object.width/2,b=object.depth/2;
 const ang=(object.rotation||0)*Math.PI/180,c=Math.cos(ang),s=Math.sin(ang);
 const y=topOf(object)+.018; // just above asphalt/sidewalk/grass paint
 const world=(x,z)=>[
  round(object.x+x*c+z*s),round(y),round(object.z-x*s+z*c)
 ];
 const segments=[];
 const add=(x1,z1,x2,z2)=>segments.push([world(x1,z1),world(x2,z2)]);
 const xLines=Math.ceil(object.width/step),zLines=Math.ceil(object.depth/step);
 for(let i=0;i<=xLines;i++){
  const x=Math.min(a,-a+i*step);
  add(x,-b,x,b);
 }
 for(let i=0;i<=zLines;i++){
  const z=Math.min(b,-b+i*step);
  add(-a,z,a,z);
 }
 // Distinct terrain edge prevents roads and sidewalks from looking misaligned.
 return segments;
}
export function groundGridSegments(requestedStep=1,extent=50){
 const step=gridStep(requestedStep),n=Math.ceil(extent/step),segments=[];
 for(let k=-n;k<=n;k++){
  const p=round(k*step);
  segments.push([[p,.027,-extent],[p,.027,extent]]);
  segments.push([[-extent,.027,p],[extent,.027,p]]);
 }
 return segments;
}

/** White stripes drawn along the crosswalk's local depth, aligned to its road width. */
export function crosswalkStripePolygons(o){
 if(o.preset!=='crosswalk')return [];
 const w=o.width/2,d=o.depth/2,angle=(o.rotation||0)*Math.PI/180;
 const c=Math.cos(angle),s=Math.sin(angle),y=topOf(o)+.012;
 const world=(x,z)=>[round(o.x+x*c+z*s),round(y),round(o.z-x*s+z*c)];
 const stripes=[];
 for(let z=-d+.16;z<d-.08;z+=.46){
  const end=Math.min(d-.08,z+.25);
  stripes.push([world(-w+.15,z),world(w-.15,z),world(w-.15,end),world(-w+.15,end)]);
 }
 return stripes;
}
