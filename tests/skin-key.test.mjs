import test from 'node:test';import assert from 'node:assert/strict';
import {createGenesis,normalizeCharacter} from '../src/model.js';
import {SKIN_TOKENS,DEFAULT_SKIN_KEY,resolveSkinColor,convertLegacySkinPixels} from '../src/skin.js';
import {VIEWS} from '../src/constants.js';
test('SkinKey tokens render to independent base/highlight/shadow colors',()=>{
 const c=createGenesis(),head=c.views.front.parts.find(p=>p.id==='head');
 assert.ok(Object.values(head.pixels).includes(SKIN_TOKENS.base));
 assert.equal(resolveSkinColor(SKIN_TOKENS.base,c.skinKey),DEFAULT_SKIN_KEY.base);
 c.skinKey={base:'#334455',light:'#556677',shadow:'#112233'};
 assert.equal(resolveSkinColor(SKIN_TOKENS.base,c.skinKey),'#334455');
 assert.equal(resolveSkinColor(SKIN_TOKENS.light,c.skinKey),'#556677');
 assert.equal(resolveSkinColor(SKIN_TOKENS.shadow,c.skinKey),'#112233');
 for(const view of VIEWS)assert.ok(Object.values(c.views[view].parts.find(p=>p.id==='head').pixels).includes(SKIN_TOKENS.base));
});
test('Old Genesis face/hair survives import as detached art backup, never visible rig',()=>{
 const c=createGenesis(),head=c.views.front.parts.find(p=>p.id==='head');
 head.pixels['31,20']='#d99b7a';
 c.views.front.parts.push({id:'face',label:'Wajah',parent:'head',pixels:{'30,30':'#000000'},pivot:[32,31],offset:[0,0],angle:0,visible:true});
 c.views.front.parts.push({id:'hair',label:'Rambut',parent:'head',pixels:{'27,20':'#121212'},pivot:[32,20],offset:[0,0],angle:0,visible:true});
 normalizeCharacter(c);
 assert.equal(c.views.front.parts.length,15);
 assert.deepEqual(c.appearance.legacyDetachedLayers.front.map(p=>p.id),['face','hair']);
 assert.equal(head.pixels['31,20'],SKIN_TOKENS.base);
 const once=JSON.stringify(c.appearance.legacyDetachedLayers);
 normalizeCharacter(c);assert.equal(JSON.stringify(c.appearance.legacyDetachedLayers),once);
});
test('Other colors not affected by SkinKey migration',()=>{
 const c=createGenesis();const torso=c.views.front.parts.find(p=>p.id==='torso');
 torso.pixels['24,44']='#46627a';
 convertLegacySkinPixels(c);assert.equal(torso.pixels['24,44'],'#46627a');
});
