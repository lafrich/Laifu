import test from 'node:test';import assert from 'node:assert/strict';
import {makeObject,newWorld,topOf,DOOR_HEIGHT,CHARACTER_HEIGHT,LEVEL_STEP} from '../src/world.js';
import {resolvePlacement,validatePlacement,overlapXZ,containsFootprint,surfaceType} from '../src/placement.js';
const at=(p,x,z,y=0,opts={})=>Object.assign(makeObject(p,x,z,y),opts);
test('terrain grid edge alignment and rotated footprints',()=>{
 const asphalt=at('road',0,0,0,{width:8,depth:8});
 const walk=at('sidewalk',5,0,0,{width:2,depth:8});
 assert.equal(overlapXZ(asphalt,walk),false,'flush edges not an overlap');
 assert.equal(resolvePlacement(at('road',.3,.1),[],1).object.x,0);
 const rotated=at('road',2,0,0,{width:8,depth:4,rotation:90});
 assert.equal(containsFootprint(rotated,at('character',2,0,.24,{width:.6,depth:.2})),true);
});
test('trees require grass, vehicle requires asphalt, NPC requires sidewalk or zebra',()=>{
 const asphalt=at('road',0,0,0,{width:8,depth:8});
 const sidewalk=at('sidewalk',5,0,0,{width:2,depth:8});
 const grass=at('grass',-10,0,0,{width:8,depth:8});
 const zebra=at('zebra',0,0,.24,{width:8,depth:2});
 const base=[asphalt,sidewalk,grass,zebra];
 assert.equal(validatePlacement(at('tree',0,0,.24),base).ok,false);
 assert.equal(validatePlacement(at('tree',-10,0,topOf(grass)),base).ok,true);
 assert.equal(validatePlacement(at('vehicle',0,2,topOf(asphalt)),base).ok,true);
 assert.equal(validatePlacement(at('vehicle',5,2,topOf(sidewalk)),base).ok,false);
 assert.equal(validatePlacement(at('character',5,2,topOf(sidewalk)),base).ok,true);
 assert.equal(validatePlacement(at('character',0,0,topOf(zebra)),base).ok,true);
 assert.equal(validatePlacement(at('character',0,3,topOf(asphalt)),base).ok,false);
});
test('collision prevents penetration but allows objects on top',()=>{
 const box=at('house',20,0,0),others=[box];
 assert.equal(validatePlacement(at('house',20.5,0,0),others).ok,false);
 assert.equal(validatePlacement(at('house',20,0,4),others).ok,true);
 const rotated=at('house',22,0,0,{width:5,depth:3,rotation:90});
 assert.equal(validatePlacement(rotated,others).ok,false);
});
test('zebra overlay may rest on asphalt but not on sidewalk',()=>{
 const asphalt=at('road',0,0,0,{width:8,depth:8});
 const zebra=at('zebra',0,0,topOf(asphalt),{width:8,depth:2});
 const walk=at('sidewalk',5,0,0,{width:2,depth:8});
 assert.equal(validatePlacement(zebra,[asphalt,walk]).ok,true);
 assert.equal(resolvePlacement(at('zebra',0,0,0,{width:8,depth:2}),[asphalt,walk],1).object.y,topOf(asphalt));
 assert.equal(validatePlacement(zebra,[]).ok,false);
 assert.equal(validatePlacement(at('zebra',5,0,topOf(walk)),[asphalt,walk]).ok,false);
});
test('sample world contains no accidental collisions and scale stays 1:1:2',()=>{
 assert.equal(DOOR_HEIGHT,CHARACTER_HEIGHT);assert.equal(LEVEL_STEP,DOOR_HEIGHT*2);
 const w=newWorld(true);
 for(const o of w.objects){
  const others=w.objects.filter(p=>p.id!==o.id);
  const result=validatePlacement(o,others);
  assert.equal(result.ok,true,o.preset+': '+result.reason);
 }
});
