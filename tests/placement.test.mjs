import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,makeObject,DOOR_HEIGHT,LEVEL_STEP,MIN_BUILDING_HEIGHT} from '../src/world.js';
import {evaluatePlacement,surfaceType,snapObject,footprintIntersects,findPlayerSpawn,simulateStep} from '../src/placement-rules.js';

const sample=()=>newWorld(true);
const evalAt=(id,x,z,objects=sample(),rotation=0)=>evaluatePlacement(
 {...makeObject(id,x,z),rotation},objects,{grid:1,snapEnabled:true,levelBase:0}
);
test('fixed ratio and surfaces for zoning sample',()=>{
 assert.equal(DOOR_HEIGHT,2);assert.equal(LEVEL_STEP,4);assert.equal(MIN_BUILDING_HEIGHT,4);
 const w=sample();assert.equal(w.objects.length,14);
 for(const o of w.objects){
  const others=w.objects.filter(x=>x.id!==o.id);
  assert.equal(evaluatePlacement(o,others,{grid:1,snapEnabled:false,levelBase:0}).ok,true,o.preset+' at '+o.x+','+o.z);
 }
 assert.equal(surfaceType(makeObject('road')),'asphalt');
 assert.equal(surfaceType(makeObject('sidewalk')),'sidewalk');
 assert.equal(surfaceType(makeObject('grass')),'grass');
 assert.equal(surfaceType(makeObject('crosswalk')),'crosswalk');
});
test('surface categories are enforced with complete footprint coverage',()=>{
 const w=sample().objects;
 assert.match(evalAt('tree',0,5,w).reason,/GRASS/);
 assert.match(evalAt('vehicle',-9,0,w).reason,/ASPHALT/);
 assert.match(evalAt('character',-10,0,w).reason,/SIDEWALK/);
 assert.equal(evalAt('tree',-10,3,w).ok,true);
 assert.equal(evalAt('vehicle',2,10,w).ok,false); // collides with an existing vehicle
 assert.equal(evalAt('character',-5,4,w).ok,true);
 const crosswalk=evalAt('character',0,2,w);
 assert.equal(crosswalk.ok,true);
 assert.ok(crosswalk.object.y>.24);
});
test('asphalt and sidewalk cannot overlap; zebra may overlay asphalt only',()=>{
 const w=sample().objects;
 const duplicate=evalAt('road',0,0,w);
 assert.equal(duplicate.ok,false);
 assert.match(duplicate.reason,/Bertabrakan/);
 const crossing=evalAt('crosswalk',0,2,w);
 assert.equal(crossing.ok,false); // duplicate crosswalk
 const blank=evalAt('crosswalk',-14,0,w);
 assert.equal(blank.ok,false);
 assert.match(blank.reason,/aspal/i);
});
test('grid edges align for odd-width rotated terrain, and collision follows 90°',()=>{
 const a={...makeObject('sidewalk',2.1,1.9),width:3,depth:6,rotation:0};
 const aligned=snapObject(a,1,true);
 assert.equal(aligned.x,2.5);
 assert.equal(aligned.z,2);
 const rotated=snapObject({...a,rotation:90},1,true);
 assert.equal(rotated.x,2);
 assert.equal(rotated.z,2.5);
 const car=makeObject('vehicle',0,0);
 car.width=2;car.depth=4;
 const second={...car,x:2.4,z:0,rotation:90};
 assert.equal(footprintIntersects(car,second),true);
 assert.equal(footprintIntersects(car,{...second,x:8}),false);
});
test('placed objects cannot intersect, even with grid snapping disabled',()=>{
 const w=sample().objects;
 const tree=evalAt('tree',-10,3,w);
 assert.equal(tree.ok,true);
 const duplicated=evaluatePlacement({...tree.object,id:'newtree'},[...w,tree.object],{grid:1,snapEnabled:false,levelBase:0});
 assert.equal(duplicated.ok,false);
 assert.match(duplicated.reason,/Bertabrakan/);
});
test('simulation starts on sidewalk and cannot cross forbidden terrain or obstacles',()=>{
 const w=sample().objects,player=findPlayerSpawn(w);
 assert.ok(player);
 assert.ok(player.y>=.26);
 const current=simulateStep(player,0,0,w);
 assert.equal(current.ok,true);
 const outside=simulateStep({...player,x:-5,z:10},-4,0,w);
 assert.equal(outside.ok,false);
});
