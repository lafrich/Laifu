import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGenesis,normalizeCharacter} from '../src/model.js';
import {createEmotion,paintPixel} from '../src/emotion.js';
const html=readFileSync(new URL('../apps/laifu-emosi/index.html',import.meta.url),'utf8');
const editor=readFileSync(new URL('../src/emosi-editor.js',import.meta.url),'utf8');
test('All Laifu Emosi editor controls exist in its HTML shell',()=>{
 const referenced=[...new Set([...editor.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))];
 assert.ok(referenced.length>=40,'substantial editable UI is wired');
 for(const id of referenced)assert.ok(html.includes('id="'+id+'"'),'missing UI element '+id);
 assert.ok(html.includes('src="../../src/emosi-editor.js"'));
});
test('An Emosi overlay attaches to one existing Genesis head, without face/hair rig',()=>{
 const character=createGenesis(),emo=createEmotion('Talk',3);
 paintPixel(emo,'front',0,32,39,'#234567');
 character.faceOverlay=emo;character.faceRef={source:'laifu.emotion.v1',id:emo.id};
 const normalized=normalizeCharacter(JSON.parse(JSON.stringify(character)));
 assert.equal(normalized.faceOverlay.anchor.bone,'head');
 assert.equal(normalized.faceOverlay.views.front.frames[0].pixels['32,39'],'#234567');
 for(const v of ['front','left','right','back']){
  assert.ok(normalized.views[v].parts.find(x=>x.id==='head'));
  assert.ok(!normalized.views[v].parts.find(x=>x.id==='face'||x.id==='hair'));
 }
});
