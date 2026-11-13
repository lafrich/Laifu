import test from 'node:test';import assert from 'node:assert/strict';
import {LAIFU_SCALE,FRAME,VIEWS,PARTS} from '../src/constants.js';
import {createGenesis,normalizeCharacter,putPixel,flipPixels,shiftPixels,sampleAngles} from '../src/model.js';
test('1 character = 1 door; 1 level = 2 doors; min building = 2 doors',()=>{assert.equal(LAIFU_SCALE.characterHeight,2);assert.equal(LAIFU_SCALE.doorUnits,2);assert.equal(LAIFU_SCALE.levelHeight,4);assert.equal(LAIFU_SCALE.minBuildingHeight,4);});
test('one Genesis template supports two categories and four editable views',()=>{const c=createGenesis();assert.equal(c.genesis,'male');assert.deepEqual(Object.keys(c.views),VIEWS);for(const v of VIEWS)assert.equal(c.views[v].parts.length,PARTS.length);normalizeCharacter(c);c.genesis='female';normalizeCharacter(c);});
test('invalid character scale must be rejected, never silently corrected',()=>{const c=createGenesis();c.scale.characterHeight=3;assert.throws(()=>normalizeCharacter(c),/Skala Laifu/);});
test('pixel editing, shift, mirror and animation work',()=>{const c=createGenesis(),p=c.views.front.parts[0];p.pixels={};putPixel(p,10,10,'#ffffff');shiftPixels(p,1,2);assert.equal(p.pixels['11,12'],'#ffffff');flipPixels(p);assert.ok(Object.keys(p.pixels).length===1);const angles=sampleAngles(c.animations.walk,3);assert.equal(angles.thighL,0);});
test('foot origin remains inside frame',()=>{assert.equal(FRAME.footX,32);assert.equal(FRAME.footY,107);assert.ok(FRAME.footY<FRAME.height);});

test('existing character exports in 1u units migrate to 2u character/4u level without pixel changes',()=>{const c=createGenesis();const original=Object.keys(c.views.front.parts[0].pixels).length;c.scale={doorUnits:1,characterHeight:1,levelHeight:2,minBuildingHeight:2};normalizeCharacter(c);assert.deepEqual(c.scale,LAIFU_SCALE);assert.equal(Object.keys(c.views.front.parts[0].pixels).length,original);});
