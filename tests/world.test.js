import test from 'node:test';
import assert from 'node:assert/strict';
import {
 SCHEMA,DOOR_HEIGHT,CHARACTER_HEIGHT,LEVEL_STEP,MIN_BUILDING_HEIGHT,
 makeObject,newWorld,parseWorld,serializeWorld,levelY,surfaceAt,
 heightForPlacement,pickEntity,validateObject,PRESETS
} from '../src/world.js';
import {intersectPlane,multiply,ident,invert,transformPoint} from '../src/math.js';

test('door, character, level, minimum building use ratio 1:1:2',()=>{
 assert.equal(DOOR_HEIGHT,2);assert.equal(CHARACTER_HEIGHT,2);
 assert.equal(LEVEL_STEP,4);assert.equal(MIN_BUILDING_HEIGHT,4);
 for(const id of ['house','block','tower'])assert.ok(makeObject(id).height>=4);
 assert.equal(makeObject('character').height,2);
 assert.equal(levelY(0),0);assert.equal(levelY(1),4);assert.equal(levelY(3),12);
});

test('all presets use new procedural geometry, not Semesta assets',()=>{
 assert.ok(PRESETS.length>=10);
 assert.equal(PRESETS.some(p=>p.image||p.sprite||p.asset),false);
 for(const p of PRESETS){const obj=makeObject(p.id);assert.equal(obj.preset,p.id);assert.equal(obj.kind,p.kind);assert.deepEqual(obj.textures,{});}
});

test('invalid small building and tall character are normalized',()=>{
 const b=validateObject({...makeObject('house'),height:1});assert.equal(b.height,4);
 const c=validateObject({...makeObject('character'),height:100});assert.equal(c.height,2);
});

test('world JSON round trip keeps face textures and logic',()=>{
 const w=newWorld(false);const o=makeObject('bus',10,12,8);
 o.textures.front='data:image/png;base64,cXV4';o.tags=['public-transport'];o.actions=['ride'];w.objects.push(o);
 const result=parseWorld(serializeWorld(w));
 assert.equal(result.schema,SCHEMA);assert.equal(result.objects[0].textures.front,o.textures.front);
 assert.deepEqual(result.objects[0].actions,['ride']);assert.equal(result.objects[0].y,8);
});

test('surface drop snaps to top face of supporting rotated platform',()=>{
 const ground=makeObject('platform',0,0,8);ground.width=10;ground.depth=10;ground.height=.5;
 const ray={origin:[0,20,0],direction:[0,-1,0]};
 const hit=surfaceAt(ray,[ground]);assert.ok(hit);assert.equal(hit.y,8.5);
 const place=heightForPlacement('surface',0,ray,[ground]);assert.equal(place.y,8.5);
 assert.equal(place.mode,'surface');
 assert.equal(heightForPlacement('level:3',0,ray,[]).y,12);
});

test('ray picking finds a six-sided box and billboard with camera yaw',()=>{
 const box=makeObject('house',0,0,0);
 const hit=pickEntity({origin:[0,8,0],direction:[0,-1,0]},[box]);assert.equal(hit.entity.id,box.id);
 const plane=makeObject('character',0,0,0);
 const front=pickEntity({origin:[0,1,5],direction:[0,0,-1]},[plane],0);
 assert.equal(front.entity.id,plane.id);
});

test('import rejects foreign and overly large worlds',()=>{
 assert.throws(()=>parseWorld({schema:'semesta.v1',objects:[]}));
 assert.throws(()=>parseWorld({schema:SCHEMA,objects:Array(2001).fill({})}));
});

test('matrix inversion preserves 3D points',()=>{
 const m=[2,0,0,0,0,3,0,0,0,0,4,0,5,6,7,1];
 const inv=invert(m);const v=transformPoint(m,[3,-2,1]);
 assert.deepEqual(transformPoint(inv,v).map(x=>Math.round(x)),[3,-2,1]);
});
