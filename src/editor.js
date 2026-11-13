import './style.css';
import {FRAME,VIEWS,PARTS,PALETTE,LAIFU_SCALE} from './constants.js';
import {createGenesis,getPart,putPixel,fillPixel,shiftPixels,flipPixels,sampleAngles} from './model.js';
import {drawCharacter,invalidatePart,applyPartTransform} from './render.js';
import {exportPackage,loadCharacterFile} from './format.js';
let character=createGenesis(),view='front',selected='torso',tool='pencil',color=PALETTE[0],zoom=5,grid=true,bones=true,playing=false,anim='idle',frame=0,drag=null,clipboard=null,selection=null,dirty=false;
let history=[JSON.stringify(character)],historyAt=0,lastTime=0,lastTick=0;
const $=s=>document.querySelector(s);
const toast=m=>{let n=$('.toast');if(!n){n=document.createElement('div');n.className='toast';document.body.append(n);}n.textContent=m;clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.remove(),3500);};
const markDirty=()=>{dirty=true;$('#status').textContent='● Perubahan belum diekspor';$('#status').style.color='#ffce9b';};
const pushHistory=()=>{const s=JSON.stringify(character);if(history[historyAt]===s)return;history=history.slice(0,historyAt+1);history.push(s);if(history.length>40)history.shift();historyAt=history.length-1;markDirty();updateInspector();};
const restore=n=>{if(n<0||n>=history.length)return;historyAt=n;character=JSON.parse(history[n]);markDirty();syncFields();render();};
const part=()=>getPart(character,view,selected);
const anglePose=()=>playing||frame>0?sampleAngles(character.animations[anim],frame):{};
const canvasShell=()=>$('#canvas-shell');
const app=$('#app');
app.innerHTML=`<div class="app">
 <header class="top"><div><div class="logo">LAIFU <span>CHARACTER</span></div><div class="brand-sub">Genesis · part editor · skeletal 2D</div></div>
 <div class="top-middle"><span id="status" class="status">Belum ada ekspor</span><button id="new" class="btn">+ Template baru</button><button id="import" class="btn">Import</button><input id="import-file" type="file" accept=".json,.zip,application/json,application/zip" hidden><button id="export" class="btn primary">↧ Export Manual ZIP</button></div></header>
 <div class="workspace">
  <aside class="sidebar"><div class="section-title">GENESIS TEMPLATE <span class="tag">BASE 01</span></div>
    <div class="stack"><label class="field">Nama karakter <input id="char-name" value="Genesis 01" maxlength="60"></label><label class="field">Kategori Genesis<select id="category"><option value="male">Male Genesis</option><option value="female">Female Genesis</option></select></label></div>
    <div class="section-title">BODY PARTS <span id="part-count">17</span></div><div id="parts" class="parts"></div>
    <div class="hr"></div><div class="section-title">ATURAN SKALA LAIFU</div><div class="summary-box">Karakter = <b>1 pintu = 1 unit</b><br>1 level = <b>2 unit</b><br>Bangunan terkecil = <b>2 unit</b><br>Foot pivot = <b>Y 0 di map</b></div>
    <p class="notice">Satu template dasar. Male/Female adalah kategori ekspor; pixel tiap bagian bisa disesuaikan sendiri.</p>
  </aside>
  <main class="stage"><div class="toolbar" id="tools">
    <button class="tool active" data-tool="pencil" title="Brush · B">✎ Brush</button><button class="tool" data-tool="eraser" title="Eraser · E">◇ Erase</button><button class="tool" data-tool="fill" title="Fill · G">▧ Fill</button><button class="tool" data-tool="select" title="Select · S">▣ Select</button><button class="tool" data-tool="move" title="Move · M">✥ Move</button><button class="tool" data-tool="pivot" title="Pivot · P">⊙ Pivot</button><button class="tool" data-tool="rotate" title="Rotate · R">⟳ Rotate</button><span class="separator"></span>
    <button id="undo" class="tool" title="Ctrl+Z">↶</button><button id="redo" class="tool" title="Ctrl+Y">↷</button><button id="copy" class="tool">Copy</button><button id="paste" class="tool">Paste</button><button id="pasteflip" class="tool">Paste Flip</button><button id="flip" class="tool">Flip Part</button>
  </div>
  <div id="canvas-shell" class="canvas-shell"><canvas id="pixel-canvas" width="320" height="560" aria-label="Character pixel canvas"></canvas><div class="foot-note">● Garis dasar: telapak kaki → world Y=0 &nbsp; · &nbsp; Scroll: Zoom &nbsp; · &nbsp; Space+Drag: Pan</div></div>
  <div class="viewbar"><div class="views" id="views"></div><div class="row"><label class="toggle"><input type="checkbox" id="show-grid" checked> Grid</label><label class="toggle"><input type="checkbox" id="show-bones" checked> Pivot / Bones</label><button id="zoomout" class="btn small-btn">−</button><span id="zoom-value">500%</span><button id="zoomin" class="btn small-btn">+</button></div></div>
  <div class="viewbar"><div class="row"><label class="field" style="max-width:110px">Preview pose<select id="animation"><option value="idle">Idle</option><option value="walk">Walk</option><option value="sit">Sit</option></select></label><button id="play" class="btn small-btn">▶ Play</button><label class="field">Frame <input type="range" id="frame" min="0" max="12" value="0"></label><span id="frame-label" class="value">0</span></div><span>Setup pixels per-view · rig pose preview</span></div>
  </main>
  <aside class="sidebar right"><div class="section-title">COLOR PALETTE</div><div id="palette" class="palette"></div><div class="row" style="margin-top:10px"><label class="field">Warna custom <input id="color" type="color" value="${color}" style="min-height:34px;padding:3px"></label><span id="color-label" class="status">${color}</span></div>
   <div class="section-title">PART INSPECTOR</div><div class="title-row"><h2 id="selected-name">Torso</h2><span class="tag" id="selected-id">torso</span></div>
   <div class="stack" style="margin-top:13px"><label class="toggle"><input id="part-visible" type="checkbox" checked> Visible</label><label class="toggle"><input id="part-locked" type="checkbox"> Lock pixel editor</label>
    <div class="inspector-fields"><label class="field">Pivot X<input id="pivot-x" type="number" step="1"></label><label class="field">Pivot Y<input id="pivot-y" type="number" step="1"></label><label class="field">Offset X<input id="offset-x" type="number" step="1"></label><label class="field">Offset Y<input id="offset-y" type="number" step="1"></label></div>
    <label class="field">Bone rotation <div class="row"><input class="range" id="angle" type="range" min="-180" max="180" value="0"><input id="angle-num" type="number" min="-180" max="180" step="1" style="width:66px"></div></label>
    <div class="row"><button id="reset-transform" class="btn">Reset transform</button><button id="clear-part" class="btn danger">Clear pixels</button></div></div>
   <div class="section-title">EXPORT CONTRACT</div><div class="summary-box">Format <b>laifu.character.v1</b><br>Views <b>Front · Left · Right · Back</b><br>16-bit? <b>No, RGBA PNG</b><br>Plane <b>billboard, transparent</b><br>Height <b>1 door</b><br>Save mode <b>manual only</b></div>
   <p class="notice">Hasil ZIP: <b>character.json</b> (semua layer + bones), PNG setiap view, dan PNG cropped. Tidak ada autosave / Drive sync.</p>
   <a class="btn" style="display:block;text-align:center;text-decoration:none" href="../laifu-map/">Buka Laifu Map Test ↗</a>
  </aside>
 </div><footer class="footer">LAIFU / Character v0.1 · Rigby2D-inspired skeletal parts + slots · File eksport adalah sumber desain · Ctrl+Z Undo / Ctrl+Y Redo</footer>
</div>`;
const cv=$('#pixel-canvas');let pan={x:0,y:0},spaceDown=false;
function buildPartList(){const el=$('#parts');el.innerHTML='';for(const def of PARTS){const p=getPart(character,view,def.id);const row=document.createElement('div');row.className='part'+(selected===p.id?' selected':'');row.innerHTML=`<button type="button" class="eye btn ghost" title="Toggle visibility">${p.visible?'◉':'○'}</button><span>${p.label}</span><small>${Object.keys(p.pixels).length}px</small>`;row.addEventListener('click',e=>{if(e.target.closest('.eye')){p.visible=!p.visible;pushHistory();}else{selected=p.id;selection=null;}buildPartList();updateInspector();render();});el.append(row);}}
function updateInspector(){const p=part();$('#selected-name').textContent=p.label;$('#selected-id').textContent=p.id;for(const [id,val] of [['pivot-x',p.pivot[0]],['pivot-y',p.pivot[1]],['offset-x',p.offset[0]],['offset-y',p.offset[1]],['angle',p.angle],['angle-num',p.angle]])$('#'+id).value=val;$('#part-visible').checked=p.visible;$('#part-locked').checked=p.locked;$('#part-count').textContent=PARTS.length;$('#undo').disabled=historyAt<=0;$('#redo').disabled=historyAt>=history.length-1;}
function syncFields(){$('#char-name').value=character.name;$('#category').value=character.genesis;buildPartList();updateInspector();}
function buildViews(){$('#views').innerHTML='';for(const v of VIEWS){const b=document.createElement('button');b.className='btn small-btn'+(view===v?' active':'');b.textContent=v.charAt(0).toUpperCase()+v.slice(1);b.onclick=()=>{view=v;selection=null;buildViews();buildPartList();updateInspector();render();};$('#views').append(b);}}
function buildPalette(){$('#palette').innerHTML='';for(const c of PALETTE){const b=document.createElement('button');b.className='swatch'+(c===color?' active':'');b.style.background=c;b.title=c;b.setAttribute('aria-label','Warna '+c);b.onclick=()=>{color=c;$('#color').value=color;$('#color-label').textContent=color;buildPalette();};$('#palette').append(b);}}
function currentPoint(e){const r=cv.getBoundingClientRect();return {x:Math.floor((e.clientX-r.left)*FRAME.width/r.width),y:Math.floor((e.clientY-r.top)*FRAME.height/r.height)};}
function setZoom(n){zoom=Math.min(10,Math.max(2,n));cv.width=FRAME.width*zoom;cv.height=FRAME.height*zoom;cv.style.width=cv.width+'px';cv.style.height=cv.height+'px';$('#zoom-value').textContent=zoom*100+'%';render();}
function render(){if(!cv.isConnected)return;const ctx=cv.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.imageSmoothingEnabled=false;ctx.scale(zoom,zoom);
 for(let y=0;y<FRAME.height;y+=8)for(let x=0;x<FRAME.width;x+=8){ctx.fillStyle=(Math.floor(x/8)+Math.floor(y/8))%2?'#293442':'#334153';ctx.fillRect(x,y,8,8);}
 drawCharacter(ctx,character,view,anglePose());
 if(grid){ctx.strokeStyle='rgba(236,244,255,.14)';ctx.lineWidth=1/zoom;for(let x=0;x<=FRAME.width;x++) {ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,FRAME.height);ctx.stroke();}for(let y=0;y<=FRAME.height;y++){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(FRAME.width,y);ctx.stroke();}}
 ctx.strokeStyle='#7ae8ba';ctx.lineWidth=1.1/zoom;ctx.setLineDash([2,2]);ctx.beginPath();ctx.moveTo(0,FRAME.footY+1);ctx.lineTo(FRAME.width,FRAME.footY+1);ctx.stroke();ctx.setLineDash([]);
 const parts=character.views[view].parts;if(bones){for(const p of parts){const parent=parts.find(x=>x.id===p.parent);if(parent){ctx.strokeStyle='rgba(181,210,250,.45)';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(...parent.pivot);ctx.lineTo(...p.pivot);ctx.stroke();}ctx.fillStyle=p.id===selected?'#ffe99c':'#b6d1f7';ctx.beginPath();ctx.arc(...p.pivot,p.id===selected?1.65:.75,0,Math.PI*2);ctx.fill();}}
 if(selection){const {x,y,w,h}=selection;ctx.lineWidth=.5;ctx.strokeStyle='#c6e9ff';ctx.setLineDash([2,2]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);}
}
function chooseTool(t){tool=t;for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===tool);cv.style.cursor=['pencil','eraser','fill','pivot'].includes(tool)?'crosshair':tool==='move'?'move':'cell';}
const within=(p)=>p.x>=0&&p.x<64&&p.y>=0&&p.y<112;
function doStroke(pt){if(!within(pt))return;const p=part();if(p.locked)return;let changed=false;if(tool==='pencil'||tool==='eraser'){changed=putPixel(p,pt.x,pt.y,tool==='pencil'?color:null);}else if(tool==='fill'){fillPixel(p,pt.x,pt.y,color);changed=true;}if(changed){invalidatePart(p);buildPartList();render();}}
cv.addEventListener('pointerdown',e=>{e.preventDefault();const pt=currentPoint(e),p=part();cv.setPointerCapture(e.pointerId);if(spaceDown){drag={type:'pan',clientX:e.clientX,clientY:e.clientY,startX:pan.x,startY:pan.y};return;}
 if(p.locked){toast('Part dikunci. Nonaktifkan Lock di inspector.');return;}
 drag={type:tool,start:pt,last:pt,pivot:[...p.pivot],angle:p.angle,snapshot:JSON.stringify(character)};
 if(tool==='pencil'||tool==='eraser'||tool==='fill'){doStroke(pt);}else if(tool==='pivot'&&within(pt)){p.pivot=[pt.x,pt.y];updateInspector();render();}else if(tool==='select'){selection={x:pt.x,y:pt.y,w:1,h:1};render();}});
cv.addEventListener('pointermove',e=>{if(!drag)return;const pt=currentPoint(e),p=part();if(drag.type==='pan'){pan.x=drag.startX+e.clientX-drag.clientX;pan.y=drag.startY+e.clientY-drag.clientY;cv.style.transform=`translate(${pan.x}px,${pan.y}px)`;return;}
 if(drag.type==='pencil'||drag.type==='eraser'){// interpolate fast pointer strokes without missing pixels
   const x0=drag.last.x,y0=drag.last.y,steps=Math.max(Math.abs(pt.x-x0),Math.abs(pt.y-y0),1);for(let i=1;i<=steps;i++)doStroke({x:Math.round(x0+(pt.x-x0)*i/steps),y:Math.round(y0+(pt.y-y0)*i/steps)});
 }else if(drag.type==='select'){selection={x:Math.min(pt.x,drag.start.x),y:Math.min(pt.y,drag.start.y),w:Math.abs(pt.x-drag.start.x)+1,h:Math.abs(pt.y-drag.start.y)+1};render();}
 else if(drag.type==='pivot'){if(within(pt)){p.pivot=[pt.x,pt.y];updateInspector();render();}}
 else if(drag.type==='move'){const dx=pt.x-drag.last.x,dy=pt.y-drag.last.y;if(dx||dy){shiftPixels(p,dx,dy);invalidatePart(p);updateInspector();render();}}
 else if(drag.type==='rotate'){const a=Math.atan2(drag.start.y-drag.pivot[1],drag.start.x-drag.pivot[0]),b=Math.atan2(pt.y-drag.pivot[1],pt.x-drag.pivot[0]);p.angle=Math.round(Math.max(-180,Math.min(180,drag.angle+(b-a)*180/Math.PI)));updateInspector();render();}
 drag.last=pt;});
const finishDrag=e=>{if(!drag)return;const d=drag;drag=null;if(d.type!=='pan'&&d.snapshot!==JSON.stringify(character))pushHistory();};cv.addEventListener('pointerup',finishDrag);cv.addEventListener('pointercancel',finishDrag);
cv.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom+(e.deltaY<0?1:-1));},{passive:false});
function copyPixels(){const p=part(),b=selection||{x:0,y:0,w:64,h:112};const pixels=[];for(const [k,c] of Object.entries(p.pixels)){const [x,y]=k.split(',').map(Number);if(x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h)pixels.push([x-b.x,y-b.y,c]);}clipboard={pixels,w:b.w,h:b.h,x:b.x,y:b.y};toast(`${pixels.length} pixels dicopy dari ${p.label}`);}
function pastePixels(flip=false){if(!clipboard){toast('Copy bagian terlebih dahulu');return;}const p=part();if(p.locked)return;for(const [x,y,c] of clipboard.pixels)putPixel(p,clipboard.x+(flip?clipboard.w-1-x:x),clipboard.y+y,c);invalidatePart(p);pushHistory();render();buildPartList();}
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>chooseTool(b.dataset.tool);
$('#copy').onclick=copyPixels;$('#paste').onclick=()=>pastePixels();$('#pasteflip').onclick=()=>pastePixels(true);
$('#flip').onclick=()=>{flipPixels(part());invalidatePart(part());pushHistory();render();};
$('#undo').onclick=()=>restore(historyAt-1);$('#redo').onclick=()=>restore(historyAt+1);
$('#zoomout').onclick=()=>setZoom(zoom-1);$('#zoomin').onclick=()=>setZoom(zoom+1);
$('#show-grid').onchange=e=>{grid=e.target.checked;render();};$('#show-bones').onchange=e=>{bones=e.target.checked;render();};
$('#color').oninput=e=>{color=e.target.value;$('#color-label').textContent=color;buildPalette();};
$('#category').onchange=e=>{character.genesis=e.target.value;pushHistory();};
$('#char-name').onchange=e=>{character.name=e.target.value||'Genesis';pushHistory();};
for(const [id,field,index] of [['pivot-x','pivot',0],['pivot-y','pivot',1],['offset-x','offset',0],['offset-y','offset',1]])$('#'+id).onchange=e=>{const n=Number(e.target.value);if(Number.isFinite(n)){part()[field][index]=n;pushHistory();render();}};
$('#angle').oninput=e=>{part().angle=Number(e.target.value);$('#angle-num').value=e.target.value;render();};$('#angle').onchange=pushHistory;
$('#angle-num').onchange=e=>{part().angle=Math.max(-180,Math.min(180,Number(e.target.value)||0));pushHistory();updateInspector();render();};
$('#part-visible').onchange=e=>{part().visible=e.target.checked;pushHistory();render();buildPartList();};$('#part-locked').onchange=e=>{part().locked=e.target.checked;pushHistory();};
$('#reset-transform').onclick=()=>{const p=part(),ref=PARTS.find(x=>x.id===p.id);p.angle=0;p.offset=[0,0];p.pivot=[...ref.pivot];pushHistory();render();};
$('#clear-part').onclick=()=>{if(!confirm(`Kosongkan seluruh pixels ${part().label} pada view ${view}?`))return;part().pixels={};invalidatePart(part());pushHistory();buildPartList();render();};
$('#new').onclick=()=>{if(dirty&&!confirm('Perubahan belum diekspor. Buat template baru dan buang perubahan?'))return;character=createGenesis();history=[JSON.stringify(character)];historyAt=0;dirty=false;view='front';selected='torso';selection=null;$('#status').textContent='Template baru · belum diekspor';syncFields();buildViews();render();};
$('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(dirty&&!confirm('Import akan mengganti desain saat ini yang belum diekspor. Lanjut?')){e.target.value='';return;}try{character=await loadCharacterFile(file);view='front';selected='torso';selection=null;history=[JSON.stringify(character)];historyAt=0;dirty=false;$('#status').textContent='Imported · ekspor jika ada perubahan';syncFields();buildViews();render();toast('Character berhasil diimport');}catch(err){toast('Import gagal: '+err.message);}finally{e.target.value='';}};
$('#export').onclick=async()=>{character.name=$('#char-name').value||'Genesis';try{$('#export').disabled=true;await exportPackage(character);dirty=false;$('#status').textContent='✓ File berhasil diekspor manual';$('#status').style.color='#9ce8bf';toast('ZIP tersimpan ke folder download. Tidak ada cloud sync.');}catch(e){toast('Export gagal: '+e.message);}finally{$('#export').disabled=false;}};
$('#animation').onchange=e=>{anim=e.target.value;frame=0;$('#frame').max=Math.max(1,...character.animations[anim].map(k=>k.frame));$('#frame').value=0;render();};
$('#frame').oninput=e=>{frame=Number(e.target.value);$('#frame-label').textContent=frame;render();};
$('#play').onclick=()=>{playing=!playing;$('#play').textContent=playing?'■ Stop':'▶ Play';if(!playing){frame=0;$('#frame').value=0;render();}};
function animate(ts){if(playing&&ts-lastTick>1000/(character.fps||12)){lastTick=ts;const max=Number($('#frame').max)||12;frame=(frame+1)%(max+1);$('#frame').value=frame;$('#frame-label').textContent=frame;render();}lastTime=ts;requestAnimationFrame(animate);}requestAnimationFrame(animate);
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(e.code==='Space'){e.preventDefault();spaceDown=true;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(historyAt-1);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restore(historyAt+1);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();copyPixels();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();pastePixels();}const tools={b:'pencil',e:'eraser',g:'fill',s:'select',m:'move',p:'pivot',r:'rotate'};if(!e.ctrlKey&&tools[e.key.toLowerCase()])chooseTool(tools[e.key.toLowerCase()]);});window.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false;});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
buildPalette();buildViews();syncFields();setZoom(5);chooseTool('pencil');
