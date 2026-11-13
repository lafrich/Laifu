import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer, ISO_YAW, ISO_PITCH} from '../src/renderer.js';
test('Laifu editor camera is locked to true 2:1 orthographic isometric axes',()=>{assert.equal(ISO_YAW,Math.PI/4);assert.ok(Math.abs(Math.tan(ISO_PITCH)-1/Math.sqrt(2))<1e-12);const fake={camera:{yaw:ISO_YAW,pitch:ISO_PITCH,ortho:true,distance:40,target:[0,0,0]}};Renderer.prototype.orbit.call(fake,999,999);assert.equal(fake.camera.yaw,ISO_YAW);assert.equal(fake.camera.pitch,ISO_PITCH);});
