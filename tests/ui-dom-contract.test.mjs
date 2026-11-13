import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('map startup static DOM controls exist (avoid black canvas from null onchange)',()=>{
 const js=read('src/app.js');
 const html=read('apps/laifu-map/index.html');
 const selectors=[...js.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
 const dynamicIds=new Set(['draftName']); // inserted by the Save City modal
 const absent=[...new Set(selectors)].filter(id=>!dynamicIds.has(id)&&!html.includes('id="'+id+'"')&&!html.includes("id='"+id+"'"));
 assert.deepEqual(absent,[],'All statically referenced UI elements must exist in HTML');
 assert.doesNotMatch(js,/\$\(['"]cameraType['"]\)\.onchange/,'camera view selector was removed when isometric lock was introduced');
});

test('safe 2D renderer does not billboard characters on mobile fallback',()=>{
 const js=read('src/isometric-fallback.js');
 assert.match(js,/o\.kind==='tree'\?ISO_YAW/);
 assert.doesNotMatch(js,/o\.kind==='tree'\|\|o\.kind==='character'/);
});
