import test from 'node:test';import assert from 'node:assert/strict';
import {isCameraBillboard,viewForHeading,headingForView,normalizeHeading} from '../src/character-direction.js';
import {CHARACTER_HEIGHT,DOOR_HEIGHT,LEVEL_STEP,MIN_BUILDING_HEIGHT,makeObject,validateObject} from '../src/world.js';
import {LAIFU_SCALE} from '../src/constants.js';
test('only trees use camera-facing billboards',()=>{
 assert.equal(isCameraBillboard('tree'),true);
 assert.equal(isCameraBillboard('character'),false);
 assert.equal(isCameraBillboard('building'),false);
});
test('world yaw selects four independent Genesis views',()=>{
 for(const [view,angle] of [['front',0],['right',90],['back',180],['left',270]]){
  assert.equal(headingForView(view),angle);
  assert.equal(viewForHeading(angle),view);
  assert.equal(viewForHeading(angle+360),view);
 }
 assert.equal(viewForHeading(-90),'left');
 assert.equal(viewForHeading(405),'right');
 assert.equal(normalizeHeading(NaN),0);
 assert.throws(()=>headingForView('diagonal'),/Unknown character view/);
});
test('character heading is persisted without modifying 1:1:2 scale',()=>{
 const c=makeObject('character',2,3,0);
 c.rotation=270;
 const normalized=validateObject(c);
 assert.equal(normalized.rotation,270);
 assert.equal(viewForHeading(normalized.rotation),'left');
 assert.equal(normalized.height,CHARACTER_HEIGHT);
 assert.equal(CHARACTER_HEIGHT,DOOR_HEIGHT);
 assert.equal(LEVEL_STEP,DOOR_HEIGHT*2);
 assert.equal(MIN_BUILDING_HEIGHT,DOOR_HEIGHT*2);
 assert.equal(LAIFU_SCALE.characterHeight,CHARACTER_HEIGHT);
});
