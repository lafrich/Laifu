import test from 'node:test';import assert from 'node:assert/strict';
import {createEmotion,createEmotionDatabase,normalizeEmotion,normalizeEmotionDatabase,paintPixel,insertFrame,deleteFrame,reorderFrames,textToConvoTimeline,EMOTION_MAX_FRAMES} from '../src/emotion.js';
test('One full-face image per frame and per view, not eyes/lips bones',()=>{
 const e=createEmotion('Smile',3);assert.equal(e.frameCount,3);assert.equal(e.anchor.bone,'head');
 assert.equal('parts' in e,false);
 for(const v of ['front','left','back','right'])assert.equal(e.views[v].frames.length,3);
 paintPixel(e,'front',0,31,39,'#abcdef');assert.equal(e.views.front.frames[0].pixels['31,39'],'#abcdef');
});
test('Timeline frame operations stay aligned in all four directions',()=>{
 const e=createEmotion('Test',2);paintPixel(e,'front',0,32,40,'#123456');
 insertFrame(e,1,true);assert.equal(e.frameCount,3);assert.equal(e.views.back.frames.length,3);
 reorderFrames(e,1,2);assert.equal(e.views.front.frames[2].pixels['32,40'],'#123456');
 deleteFrame(e,2);assert.equal(e.frameCount,2);
});
test('Legacy invalid pixels are filtered and anchor locked to Genesis head',()=>{
 const e=createEmotion();e.anchor.bone='face';e.views.front.frames[0].pixels['111,400']='#ffffff';
 const n=normalizeEmotion(e);assert.equal(n.anchor.bone,'head');assert.equal(n.views.front.frames[0].pixels['111,400'],undefined);
 assert.equal(normalizeEmotionDatabase(n).emotions.length,1);assert.equal(createEmotionDatabase().emotions[0].frameCount,9);
});
test('Text talk uses authored frames 0-8 and real pauses',()=>{
 const t=textToConvoTimeline('Aku, hai!',9);assert.ok(t.some(x=>x.frame===1));assert.ok(t.some(x=>x.ticks===3));
 assert.ok(t.every(x=>x.frame>=0&&x.frame<9));assert.equal(createEmotion('long',1000).frameCount,EMOTION_MAX_FRAMES);
});
