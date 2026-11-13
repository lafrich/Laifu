import test from 'node:test';
import assert from 'node:assert/strict';
import {makeObject,topOf} from '../src/world.js';
import {gridStep,groundGridSegments,surfaceGridSegments,crosswalkStripePolygons} from '../src/grid-system.js';

test('visible grid is always slightly above terrain, never below ground',()=>{
 const asphalt=makeObject('road',0,0,0);
 const grass=makeObject('grass',-10,0,0);
 const sidewalk=makeObject('sidewalk',-5,0,0);
 for(const o of [asphalt,grass,sidewalk]){
  const lines=surfaceGridSegments(o,1);
  assert.ok(lines.length>0);
  for(const pair of lines)for(const point of pair)assert.ok(point[1]>topOf(o),'grid line must sit above surface top');
 }
 const base=groundGridSegments(1,10);
 assert.ok(base.length>0);
 assert.ok(base.every(pair=>pair.every(point=>point[1]>0)));
});
test('grid spacing matches authoring precision including half cells',()=>{
 assert.equal(gridStep(.1),.25);
 assert.equal(gridStep(8),4);
 const a=makeObject('sidewalk');
 assert.ok(surfaceGridSegments(a,.5).length>surfaceGridSegments(a,1).length);
});
test('zebra cross has visible stripes inside its footprint',()=>{
 const z=makeObject('crosswalk');
 const polygons=crosswalkStripePolygons(z);
 assert.ok(polygons.length>=2);
 for(const polygon of polygons){
  assert.equal(polygon.length,4);
  assert.ok(polygon.every(p=>Math.abs(p[0]-z.x)<z.width/2));
 }
 assert.deepEqual(crosswalkStripePolygons(makeObject('grass')),[]);
});
