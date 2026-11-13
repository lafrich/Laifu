import {Renderer} from './renderer.js';
import {CanvasIsoRenderer} from './isometric-fallback.js';
import {clamp,intersectPlane} from './math.js';
import {resolvePlacement,validatePlacement,surfaceType,surfaceAtXZ} from './placement.js';
import {
 SCHEMA,PRESETS,templates,LEVEL_STEP,MAX_LEVEL,HEIGHT_MIN,HEIGHT_MAX,MAX_OBJECTS,
 CHARACTER_HEIGHT,MIN_BUILDING_HEIGHT,makeObject,newWorld,parseWorld,serializeWorld,
 heightForPlacement,surfaceAt,levelY,topOf,finite,round,snap,pickEntity,uid,boxKind
} from './world.js';

const $=id=>document.getElementById(id);
const safeHTML=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AUTO_KEY='laifu.autosave.v1',DRAFTS_KEY='laifu.drafts.v1';
function loadLocal(key,fallback){try{const item=localStorage.getItem(key);return item?JSON.parse(item):fallback;}catch{return fallback;}}
function initialWorld(){try{const raw=localStorage.getItem(AUTO_KEY);return raw?parseWorld(raw):newWorld();}catch{return newWorld();}}
let world=initialWorld(),selectedId=null,activePreset='house',mode='select',tab='layout';
let snapOn=true,showGrid=true,assetGrid=false,ghost=null,pointer=null,dragging=false,placementRotation=0;
let simulation=false,player=null,lastMove=0;const heldDirections=new Set();
let undoStack=[],redoStack=[],pendingFace=null,toastTimer=0,gesture=null;
const touches=new Map();
let renderer;
let activeMode='webgl';
let firstFrameValidated=false;
function activateSafePreview(reason){
  const oldCanvas=$('world'),newCanvas=oldCanvas.cloneNode(false);
  oldCanvas.replaceWith(newCanvas);
  renderer=new CanvasIsoRenderer(newCanvas);
  renderer.gridOn=showGrid;
  activeMode='canvas';
  for(const id of ['safePreview','safePreviewMobile']){const btn=$(id);if(btn){btn.textContent='▣ 2D SAFE ON';btn.title='CPU-only isometric preview enabled';}}
  const status=$('floatingStatus');
  if(status){
    status.style.display='block';status.style.opacity='1';status.style.pointerEvents='none';
    status.textContent='BASIC ISOMETRIC PREVIEW · '+String(reason||'WebGL unavailable').slice(0,90);
  }
}
try{renderer=new Renderer($('world'));}
catch(err){
 console.warn('Laifu WebGL unavailable; using safe isometric preview',err);
 activateSafePreview(err?.message||'WebGL failed to initialize');
}
renderer.gridOn=true;
let statusText='LOCAL DRAFT';
const getSelected=()=>world.objects.find(o=>o.id===selectedId)||null;
const allModes=['select','place','move','pan'];
const faceNames=['front','back','left','right','top','bottom'];
const iconMap={road:'▰',sidewalk:'▤',platform:'▦',house:'⌂',block:'▥',tower:'▥',vehicle:'▣',bus:'▣',tree:'♠',character:'♙',prop:'◈'};

function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}
function invalidate(){/* Request a frame; the renderer also updates after remote texture loads. */}
function saveLocal(){try{localStorage.setItem(AUTO_KEY,serializeWorld(world));statusText='● AUTO SAVED';}catch{statusText='● LOCAL STORAGE FULL · EXPORT JSON';notify('Local storage penuh. Gunakan Export JSON.');}updateStatus();}
function capture(){undoStack.push(serializeWorld(world));if(undoStack.length>50)undoStack.shift();redoStack=[];updateActions();}
function commit(){saveLocal();refresh();}
function undo(){if(!undoStack.length)return;redoStack.push(serializeWorld(world));world=parseWorld(undoStack.pop());selectedId=null;ghost=null;commit();notify('Undo');}
function redo(){if(!redoStack.length)return;undoStack.push(serializeWorld(world));world=parseWorld(redoStack.pop());selectedId=null;ghost=null;commit();notify('Redo');}
function updateActions(){const has=!!getSelected();for(const id of ['duplicate','copyObject','replace','delete','rotateL','rotateR','focus'])$(id).disabled=!has;if($('undo'))$('undo').disabled=!undoStack.length;if($('redo'))$('redo').disabled=!redoStack.length;}
function updateStatus(){const o=getSelected();$('saveStatus').textContent=statusText;$('statusCount').textContent=`${world.objects.length} OBJECTS`;
 $('objectCount').textContent=String(world.objects.length).padStart(2,'0');
 $('sceneMeta').textContent=`${world.objects.length} OBJECTS · GRID ${world.grid}`;
 $('sceneName').textContent=world.title.toUpperCase();
 $('activeAsset').textContent=o?o.name:(mode==='place'?(templates[activePreset]?.label||'NONE'):'— NONE —');
 $('modeLabel').textContent=simulation?'SIMULATE PLAYER':mode.toUpperCase();
 $('canvasHint').textContent=mode==='place'?'TAP TO DROP / CLICK TO PLACE · USE DROP ON TO CHANGE Y':mode==='move'?'DRAG AN OBJECT TO MOVE IT · Y STAYS FIXED':'SELECT OBJECT · RIGHT DRAG PAN · WHEEL / PINCH ZOOM · ISO VIEW LOCKED';
 updateActions();}
function setMode(next){if(simulation){notify('Stop simulation to edit');return;}if(!allModes.includes(next))return;mode=next;ghost=null;
 document.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('active',el.dataset.mode===mode));
 $('world').style.cursor=mode==='pan'?'grab':mode==='place'?'crosshair':'default';
 updateStatus();}
function setSelected(id){selectedId=id;renderInspector();updateStatus();}
function renderCatalog(){const query=$('assetSearch').value.toLowerCase().trim();const list=$('assetList');list.replaceChildren();list.classList.toggle('grid-view',assetGrid);
 $('assetCount').textContent=PRESETS.length;
 for(const group of [...new Set(PRESETS.map(p=>p.category))]){
  const options=PRESETS.filter(p=>p.category===group&&(!query||(`${p.label} ${p.description} ${p.category}`).toLowerCase().includes(query)));
  if(!options.length)continue;
  const head=document.createElement('div');head.className='asset-heading';head.textContent=group.toUpperCase();list.append(head);
  for(const p of options){const btn=document.createElement('button');btn.type='button';btn.className='asset-item'+(mode==='place'&&activePreset===p.id?' active':'');btn.setAttribute('role','listitem');btn.dataset.preset=p.id;
   btn.innerHTML=`<span class="asset-ico" style="color:${safeHTML(p.color)}">${iconMap[p.id]||iconMap[p.kind]||'◈'}</span><span class="asset-copy"><strong>${safeHTML(p.label)}</strong><small>${p.width}×${p.depth}×${p.height}u · ${safeHTML(p.description)}</small></span>`;
   btn.addEventListener('click',()=>{activePreset=p.id;setMode('place');renderCatalog();notify(`${p.label} · tap the canvas to place`);if(innerWidth<821)$('assetsPanel').classList.remove('open');});list.append(btn);
  }
 }
}
function populateLevelOptions(){for(const sel of [$('placementLevel'),$('objectLevelMode')]){
 const before=sel.querySelector('[value="custom"]');for(let n=1;n<=MAX_LEVEL;n++){const op=document.createElement('option');op.value=`level:${n}`;op.textContent=`LEVEL ${n} · Y ${levelY(n)}`;sel.insertBefore(op,before);}
 }}
function setTab(next){tab=next;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==tab);}
function renderInspector(){const o=getSelected(),form=$('propertyForm');form.hidden=!o;$('emptyInspector').hidden=!!o;
 $('selectedName').textContent=o?o.name:'No Selection';$('selectedKind').textContent=o?`${o.kind.toUpperCase()} · ${o.preset.toUpperCase()}`:'WORLD / EDITOR';
 if(!o){updateActions();return;}
 $('entityId').textContent=o.id;
 for(const key of ['name','x','y','z','width','height','depth','rotation','color','alpha','levelMode','tags','actions','notes','blocking','lock']){
  const el=form.elements.namedItem(key);if(!el)continue;
  if(key==='tags'||key==='actions')el.value=o[key].join(', ');
  else if(el.type==='checkbox')el.checked=!!o[key];
  else el.value=key==='levelMode'&&o.levelMode==='level'?`level:${o.level}`:o[key];
 }
 form.elements.namedItem('kindView').value=o.kind;
 form.elements.namedItem('height').min=o.kind==='building'?MIN_BUILDING_HEIGHT:.04;
 form.elements.namedItem('height').disabled=o.kind==='character';
 $('alphaValue').textContent=`${Math.round(o.alpha*100)}%`;
 $('heightSlider').value=clamp(o.y,HEIGHT_MIN,HEIGHT_MAX);
 $('heightReadout').textContent=o.y.toFixed(2);
 $('buildingRule').textContent=o.kind==='character'?'Character 2 units / 1 door. Heading 0° Front · 90° Right · 180° Back · 270° Left; plane does not face camera.':o.kind==='building'?'Buildings cannot be shorter than 4 units (2 doors / 1 level).':'A level is 4 units = two vertically stacked doors.';
 $('levelDetails').textContent=o.levelMode==='level'?`L${o.level} · base at Y ${levelY(o.level)}`:'Levels use 4 units (2 doors). Object base Y is independent of object height.';
 renderFaceRows();setTab(tab);updateActions();}
function renderFaceRows(){const o=getSelected();const root=$('faceRows');root.replaceChildren();if(!o)return;
 const faces=o.kind==='character'?['front','right','back','left','plane']:(boxKind(o.kind)?faceNames:['plane']);
 for(const face of faces){const row=document.createElement('div');row.className='face-row';
  const copy=document.createElement('div');copy.innerHTML=`<strong>${face.toUpperCase()}</strong><small>${o.textures?.[face]?'CUSTOM TEXTURE':'PLACEHOLDER COLOR / DEFAULT'}</small>`;
  const actions=document.createElement('div');actions.className='face-actions';
  for(const action of ['Upload','Clear']){const btn=document.createElement('button');btn.type='button';btn.textContent=action;btn.disabled=action==='Clear'&&!o.textures?.[face];btn.onclick=()=>{
   if(action==='Upload'){pendingFace={id:o.id,face};$('textureFile').value='';$('textureFile').click();}
   else{capture();delete o.textures[face];commit();notify(`Removed ${face} texture`);}
  };actions.append(btn);}
  row.append(copy,actions);
  const url=document.createElement('input');url.type='url';url.placeholder='Or paste image URL, then press Enter';url.value=o.textures?.[face]?.startsWith('http')?o.textures[face]:'';
  url.addEventListener('change',()=>{const v=url.value.trim();if(v&&!/^https?:\/\//i.test(v)){notify('Use a valid http/https image URL');return;}capture();if(v)o.textures[face]=v;else delete o.textures[face];commit();});row.append(url);root.append(row);
 }
}
function makePlacement(clientX,clientY,ignore=null){
 const ray=renderer.screenRay(clientX,clientY);if(!ray)return null;
 const levelMode=$('placementLevel').value,customY=finite($('placementY').value);
 const elev=heightForPlacement(levelMode,customY,ray,world.objects,ignore);
 const point=levelMode==='surface'?surfaceAt(ray,world.objects,ignore):intersectPlane(ray,elev.y);
 return point?{x:point.x,z:point.z,y:elev.y,levelMode:elev.mode,level:elev.level}:null;
}
function prepareCandidate(p,preset=activePreset,ignore=null,rotation=placementRotation){
 const o=makeObject(preset,p.x,p.z,p.y);o.rotation=rotation;o.levelMode=p.levelMode;o.level=p.level;
 return resolvePlacement(o,world.objects,snapOn?world.grid:.25,ignore);
}
function hoverPosition(clientX,clientY){
 const p=makePlacement(clientX,clientY,selectedId);if(!p){ghost=null;return;}
 if(mode==='place'){
  const result=prepareCandidate(p);ghost=result.object;
  ghost.invalid=!result.ok;
  $('placementRule').textContent=result.ok?'✓ Snap valid':'⛔ '+result.reason;
  $('placementRule').style.color=result.ok?'#166548':'#bb3434';
 }
 else ghost=null;
 const q=ghost||p;
 $('coordinates').textContent=`X ${q.x.toFixed(2)} · Y ${q.y.toFixed(2)} · Z ${q.z.toFixed(2)}`;
}
function placeAt(x,y){
 if(world.objects.length>=MAX_OBJECTS){notify('World limit reached');return;}
 const p=makePlacement(x,y);if(!p){notify('Ray tidak mencapai permukaan');return;}
 const result=prepareCandidate(p);if(!result.ok){notify('⛔ '+result.reason);return;}
 capture();world.objects.push(result.object);selectedId=result.object.id;commit();notify('Placed '+result.object.preset+' · '+result.object.rotation+'°');
}
function getRayHit(clientX,clientY){const ray=renderer.screenRay(clientX,clientY);return ray?pickEntity(ray,world.objects,renderer.camera.yaw):null;}
function moveDrag(x,y){
 const o=getSelected();if(!o||o.lock)return;
 const ray=renderer.screenRay(x,y),p=intersectPlane(ray,o.y);if(!p)return;
 const candidate={...o,x:p.x,z:p.z};
 const result=resolvePlacement(candidate,world.objects,snapOn?world.grid:.25,o.id);
 if(!result.ok){$('placementRule').textContent='⛔ '+result.reason;return;}
 if(!dragging){capture();dragging=true;}
 o.x=result.object.x;o.z=result.object.z;
 $('coordinates').textContent=`X ${o.x} · Y ${o.y} · Z ${o.z}`;
}
function duplicate(){
 const o=getSelected();if(!o||world.objects.length>=MAX_OBJECTS)return;
 const clone=structuredClone(o);clone.id=uid();clone.name=o.name+' COPY';
 let valid=null;
 for(let radius=1;radius<=8&&!valid;radius++){
  for(const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius],[radius,radius],[-radius,-radius]]){
   const r=resolvePlacement({...clone,x:o.x+dx*world.grid,z:o.z+dz*world.grid},world.objects,world.grid);
   if(r.ok){valid=r.object;break;}
  }
 }
 if(!valid){notify('Tidak ada lokasi valid untuk duplicate');return;}
 capture();world.objects.push(valid);selectedId=valid.id;commit();
}
function changeObject(fn){
 const o=getSelected();if(!o||o.lock)return;
 const before=structuredClone(o);fn(o);
 const result=validatePlacement(o,world.objects,o.id);
 if(!result.ok){Object.assign(o,before);notify('⛔ '+result.reason);renderInspector();return;}
 capture();commit();
}
function rotate(d){changeObject(o=>{o.rotation=((o.rotation+d)%360+360)%360;});}
function removeSelected(){const o=getSelected();if(!o)return;capture();world.objects=world.objects.filter(x=>x.id!==o.id);selectedId=null;commit();notify('Object deleted');}
function replaceSelected(){const old=getSelected();if(!old)return;
 capture();const fresh=makeObject(activePreset,old.x,old.z,old.y);fresh.id=old.id;fresh.rotation=old.rotation;fresh.name=templates[activePreset].label;fresh.levelMode=old.levelMode;fresh.level=old.level;fresh.tags=[...old.tags];fresh.actions=[...old.actions];fresh.notes=old.notes;
 const checked=validatePlacement(fresh,world.objects,old.id);if(!checked.ok){notify('⛔ '+checked.reason);return;}const i=world.objects.indexOf(old);world.objects[i]=fresh;commit();notify('Replaced geometry · position preserved');}
function editProperty(key,value){const o=getSelected();if(!o)return;if(o.lock&&['x','y','z','levelMode'].includes(key)){notify('Unlock object before moving it');renderInspector();return;}
 const before=structuredClone(o);
 if(['x','y','z','width','height','depth','rotation','alpha'].includes(key)){
  const number=finite(value,o[key]);if(['x','y','z'].includes(key)){o[key]=round(clamp(number,-500,500));if(key==='y')o.levelMode='custom';}
  else if(key==='height')o.height=o.kind==='character'?CHARACTER_HEIGHT:round(clamp(number,o.kind==='building'?MIN_BUILDING_HEIGHT:.04,150));
  else if(['width','depth'].includes(key))o[key]=round(clamp(number,.03,150));
  else if(key==='alpha')o.alpha=round(clamp(number,.15,1));
  else o.rotation=((round(number)%360)+360)%360;
 }else if(key==='levelMode'){
  if(value==='land'){o.y=0;o.level=0;o.levelMode='land';}
  else if(value==='surface'){
   const point=surfaceAt({origin:[o.x,600,o.z],direction:[0,-1,0]},world.objects,o.id);
   o.y=point?.y??0;o.level=0;o.levelMode=point?.supportId?'surface':'land';
  }else if(value.startsWith('level:')){o.level=clamp(Number(value.split(':')[1]),0,MAX_LEVEL);o.y=levelY(o.level);o.levelMode='level';}
  else{o.levelMode='custom';o.level=0;}
 }else if(['tags','actions'].includes(key))o[key]=value.split(',').map(t=>t.trim()).filter(Boolean).slice(0,20);
 else if(['blocking','lock'].includes(key))o[key]=!!value;
 else if(key==='name')o.name=String(value).slice(0,100)||o.name;
 else if(key==='color'&&/^#[0-9a-f]{6}$/i.test(value))o.color=value;
 else if(key==='notes')o.notes=String(value).slice(0,2000);
 const checked=validatePlacement(o,world.objects,o.id);if(!checked.ok){Object.assign(o,before);notify('⛔ '+checked.reason);renderInspector();return;}capture();commit();
}
function setLevelControl(){const v=$('placementLevel').value;$('placementY').disabled=v!=='custom';
 if(v.startsWith('level:')){const y=levelY(+v.split(':')[1]);renderer.camera.target[1]=y;notify(`DROP HEIGHT · L${v.split(':')[1]} · Y ${y}`);}
 if(v==='land')renderer.camera.target[1]=0;
}
function updateWorld(newData){world=newData;selectedId=null;ghost=null;undoStack=[];redoStack=[];renderer.fit();saveLocal();refresh();}
function refresh(){renderInspector();renderCatalog();updateStatus();invalidate();}
function initInteractions(){
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);renderCatalog();});
 $('assetSearch').addEventListener('input',renderCatalog);
 $('listView').onclick=()=>{assetGrid=false;setCatalogView();};$('gridView').onclick=()=>{assetGrid=true;setCatalogView();};
 function setCatalogView(){for(const id of ['listView','gridView'])$(id).classList.toggle('active',(id==='gridView')===assetGrid);renderCatalog();}
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
 $('placementLevel').onchange=setLevelControl;
 // Orthographic isometric projection is locked in the renderer; no cameraType control exists.
 $('gridSize').onchange=()=>{world.grid=finite($('gridSize').value,1);renderer.gridSize=world.grid;commit();};
 const enableSafePreview=()=>{
  if(activeMode==='webgl'){activateSafePreview('Manually enabled');initCanvas();notify('Basic isometric preview enabled');}
  else notify('Basic mode is active. Reload to retry WebGL.');
 };
 $('safePreview').onclick=enableSafePreview;
 $('safePreviewMobile').onclick=enableSafePreview;
 $('gridToggle').onclick=()=>{showGrid=!showGrid;renderer.gridOn=showGrid;$('gridToggle').classList.toggle('active',showGrid);};
 $('snapToggle').onclick=()=>{snapOn=!snapOn;$('snapToggle').classList.toggle('active',snapOn);};
 $('placementRotateL').onclick=()=>changePlacementRotation(-90);
 $('placementRotateR').onclick=()=>changePlacementRotation(90);
 $('simulate').onclick=toggleSimulation;
 document.querySelectorAll('[data-walk]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();heldDirections.add(b.dataset.walk);b.setPointerCapture(e.pointerId);});for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,()=>heldDirections.delete(b.dataset.walk));});
 $('undo').onclick=undo;$('redo').onclick=redo;
 $('fit').onclick=$('cameraReset').onclick=()=>renderer.fit();
 $('focus').onclick=()=>renderer.focus(getSelected());
 $('rotateL').onclick=()=>rotate(-90);$('rotateR').onclick=()=>rotate(90);
 $('duplicate').onclick=$('copyObject').onclick=duplicate;
 $('delete').onclick=removeSelected;$('replace').onclick=replaceSelected;
 $('mobileAssets').onclick=()=>$('assetsPanel').classList.toggle('open');
 $('mobileInspector').onclick=()=>$('inspectorPanel').classList.toggle('open');
 $('closeAssets').onclick=()=>$('assetsPanel').classList.remove('open');
 $('closeInspector').onclick=()=>$('inspectorPanel').classList.remove('open');
 $('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('desktop').requestFullscreen?.().catch(()=>notify('Fullscreen unavailable'));};
 $('propertyForm').addEventListener('submit',e=>e.preventDefault());
 $('propertyForm').addEventListener('change',e=>{const el=e.target;if(el.name==='kindView')return;if(el.name)editProperty(el.name,el.type==='checkbox'?el.checked:el.value);});
 $('heightSlider').addEventListener('change',e=>editProperty('y',e.target.value));
 $('textureFile').addEventListener('change',async e=>{const f=e.target.files?.[0],target=pendingFace;if(!f||!target)return;
  if(!['image/png','image/jpeg','image/webp'].includes(f.type)){notify('Upload PNG, JPEG or WEBP');return;}
  if(f.size>1700000){notify('Image too large (maximum 1.7 MB per face)');return;}
  try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f);});
   const obj=world.objects.find(o=>o.id===target.id);if(!obj)return;capture();obj.textures[target.face]=data;commit();notify(`Loaded ${target.face.toUpperCase()} texture`);
  }catch{notify('Could not read texture file');}
 });
 $('importJSON').onclick=()=>$('importFile').click();
 $('importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const parsed=parseWorld(await f.text());capture();updateWorld(parsed);notify('Laifu world imported');}catch(err){notify(`Import failed: ${err.message}`);}e.target.value='';};
 $('exportJSON').onclick=()=>{const blob=new Blob([serializeWorld(world)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`laifu-${world.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'world'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('World JSON exported');};
 $('newWorld').onclick=()=>showDialog('NEW LAIFU WORLD','Create an empty independent 3D world? Your current state remains accessible through Export JSON or saved drafts.',{confirm:'CREATE EMPTY',onConfirm:()=>{updateWorld(newWorld(false));notify('Empty Laifu world created');}});
 $('demoWorld').onclick=()=>showDialog('NEW SAMPLE','Replace the current view with the procedural sample city?',{confirm:'OPEN SAMPLE',onConfirm:()=>{updateWorld(newWorld(true));notify('Starter world loaded');}});
 $('saveDraft').onclick=()=>showDialog('SAVE CITY',`<label>WORLD NAME</label><input id="draftName" class="draft-name" maxlength="100" value="${safeHTML(world.title)}" /><p>Drafts are saved in this browser only. Export JSON for portable backups.</p>`,{confirm:'SAVE CITY',onConfirm:()=>{const name=$('draftName')?.value?.trim()||world.title;world.title=name;const drafts=loadLocal(DRAFTS_KEY,{});drafts[name]={savedAt:new Date().toISOString(),world:serializeWorld(world)};
 try{localStorage.setItem(DRAFTS_KEY,JSON.stringify(drafts));saveLocal();refresh();notify(`Saved ${name}`);}catch{notify('Browser storage full. Export JSON instead.');}}});
 $('loadDraft').onclick=()=>openDrafts();
 $('info').onclick=()=>showDialog('ABOUT LAIFU',`<strong>LAIFU.EXE · Independent 3D World Editor</strong><p>A new world editor built from scratch, with no Semesta code or assets.</p><p><strong>Scale:</strong> 1 door = 1 character = 2 units. 1 level = 2 doors = 4 units. Buildings are at least 4 units high.</p><p><strong>World:</strong> Y-up, actual 3D surfaces, six-sided textured cuboids for buildings/vehicles, world-heading character planes, camera-facing tree planes.</p><p><strong>Mouse:</strong> left click select/place, drag selected to move, right/middle drag pan (isometric view locked), wheel zoom. <strong>Touch:</strong> tools on left; two fingers to pinch and pan.</p><p><strong>File:</strong> JSON contains world geometry, logic metadata and embedded textures. Browser autosave is local-only; no Drive integration or Semesta dependency.</p>`,{hideConfirm:true});
 window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if(simulation){if(e.key==='Escape'){toggleSimulation();return;}const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(k){e.preventDefault();heldDirections.add(k);}return;}
  if(mode==='place'&&e.key.toLowerCase()==='r'){changePlacementRotation(e.shiftKey?-90:90);return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelected();}
  else if(e.key==='Escape'){if(!$('dialogShade').hidden)closeDialog();else if(mode==='place')setMode('select');else setSelected(null);}
  else if(e.key.toLowerCase()==='g'){renderer.gridOn=!renderer.gridOn;}
  else if(e.key==='f'){renderer.focus(getSelected());}
 });
 window.addEventListener('keyup',e=>{const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(k)heldDirections.delete(k);});
}
function openDrafts(){const drafts=loadLocal(DRAFTS_KEY,{});const shade=$('dialogBody');const keys=Object.keys(drafts).sort((a,b)=>(drafts[b].savedAt||'').localeCompare(drafts[a].savedAt||''));
 const html=keys.length?keys.map(name=>`<div class="draft-row"><div><strong>${safeHTML(name)}</strong><small>${safeHTML(drafts[name].savedAt?.slice(0,16).replace('T',' ')||'')}</small></div><div><button type="button" data-load="${safeHTML(name)}">OPEN</button> <button type="button" data-remove="${safeHTML(name)}">DELETE</button></div></div>`).join(''):'<p>No saved drafts yet. Use Save City to create one.</p>';
 showDialog('MY CITIES',html,{hideConfirm:true});
 shade.querySelectorAll('[data-load]').forEach(btn=>btn.onclick=()=>{const name=btn.dataset.load;try{updateWorld(parseWorld(drafts[name].world));closeDialog();notify(`Opened ${name}`);}catch(err){notify(err.message);}});
 shade.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{delete drafts[btn.dataset.remove];localStorage.setItem(DRAFTS_KEY,JSON.stringify(drafts));openDrafts();notify('Draft deleted');});
}
function showDialog(title,body,{confirm='OK',onConfirm=null,hideConfirm=false}={}){
 $('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;$('dialogConfirm').textContent=confirm;$('dialogConfirm').hidden=hideConfirm;
 $('dialogShade').hidden=false;$('dialogConfirm').onclick=()=>{if(onConfirm)onConfirm();closeDialog();};
}
function closeDialog(){$('dialogShade').hidden=true;}
$('dialogClose').onclick=$('dialogCancel').onclick=closeDialog;
$('dialogShade').onclick=e=>{if(e.target===$('dialogShade'))closeDialog();};

function initCanvas(){const cv=$('world');
 cv.addEventListener('contextmenu',e=>e.preventDefault());
 cv.addEventListener('wheel',e=>{e.preventDefault();renderer.zoom(e.deltaY);},{passive:false});
 cv.addEventListener('pointerdown',e=>{
  if(!$('dialogShade').hidden)return;
  cv.setPointerCapture(e.pointerId);touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===2){const p=[...touches.values()];gesture={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),cx:(p[0].x+p[1].x)/2,cy:(p[0].y+p[1].y)/2};pointer=null;ghost=null;return;}
  if(touches.size>2)return;
  const intent=e.button===2||e.button===1?'pan':mode;
  const hit=intent==='select'||intent==='move'?getRayHit(e.clientX,e.clientY):null;
  if(hit?.entity&&['select','move'].includes(intent))setSelected(hit.entity.id);
  pointer={id:e.pointerId,initialX:e.clientX,initialY:e.clientY,x:e.clientX,y:e.clientY,intent,hit:!!hit,moved:false};dragging=false;
 });
 cv.addEventListener('pointermove',e=>{
  const data=touches.get(e.pointerId);if(data){data.x=e.clientX;data.y=e.clientY;}
  if(touches.size>=2&&gesture){const pts=[...touches.values()],len=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;
   renderer.zoom(-Math.log(Math.max(.1,len)/Math.max(.1,gesture.distance))*780);renderer.pan(cx-gesture.cx,cy-gesture.cy);gesture={distance:len,cx,cy};return;}
  if(pointer?.id===e.pointerId){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
   if(Math.hypot(e.clientX-pointer.initialX,e.clientY-pointer.initialY)>4)pointer.moved=true;
   if(pointer.moved){if(pointer.intent==='pan')renderer.pan(dx,dy);else if(['move','select'].includes(pointer.intent)&&pointer.hit)moveDrag(e.clientX,e.clientY);}
   pointer.x=e.clientX;pointer.y=e.clientY;
  }else if(!touches.size)hoverPosition(e.clientX,e.clientY);
 });
 function endPointer(e){touches.delete(e.pointerId);
  if(touches.size<2)gesture=null;
  if(!pointer||pointer.id!==e.pointerId)return;
  const isClick=!pointer.moved,intent=pointer.intent;
  if(isClick){if(intent==='place')placeAt(e.clientX,e.clientY);else if(['select','move'].includes(intent)&&!pointer.hit)setSelected(null);}
  else if(dragging){commit();dragging=false;}
  pointer=null;hoverPosition(e.clientX,e.clientY);
 }
 cv.addEventListener('pointerup',endPointer);cv.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);gesture=null;pointer=null;if(dragging)commit();dragging=false;});
 cv.addEventListener('pointerleave',()=>{if(!pointer)ghost=null;});
}
function changePlacementRotation(delta){
 placementRotation=((placementRotation+delta)%360+360)%360;
 $('placementAngle').textContent=placementRotation+'°';
 notify('Rotation '+placementRotation+'°');
}
function toggleSimulation(){
 simulation=!simulation;heldDirections.clear();ghost=null;
 $('simulate').textContent=simulation?'■ Stop Simulation':'▶ Simulate Player';
 $('playerPad').hidden=!simulation;
 if(simulation){
  let spawn=null;
  for(const tile of world.objects.filter(o=>['sidewalk','zebra'].includes(surfaceType(o)))){
   for(const x of [tile.x,tile.x-.5,tile.x+.5]){
    const c=makeObject('character',x,tile.z,topOf(tile));c.width=.6;c.depth=.3;c.id='laifu-sim-player';
    if(validatePlacement(c,world.objects).ok){spawn=c;break;}
   }
   if(spawn)break;
  }
  if(!spawn){simulation=false;$('simulate').textContent='▶ Simulate Player';$('playerPad').hidden=true;notify('Buat area trotoar/zebra kosong untuk spawn player');return;}
  player=spawn;player.color='#eeb574';renderer.focus(player);lastMove=performance.now();
  notify('PLAYER: WASD / Arrow / tombol arah. ESC untuk keluar');
 }else{player=null;renderer.fit();}
 updateStatus();
}
function stepSimulation(){
 if(!player||!heldDirections.size){lastMove=performance.now();return;}
 const now=performance.now(),dt=Math.min(.05,(now-lastMove)/1000||.016);lastMove=now;
 const dx=(heldDirections.has('right')?1:0)-(heldDirections.has('left')?1:0);
 const dz=(heldDirections.has('down')?1:0)-(heldDirections.has('up')?1:0);
 if(!dx&&!dz)return;
 const m=Math.hypot(dx,dz),speed=3,next={...player,x:player.x+dx/m*speed*dt,z:player.z+dz/m*speed*dt};
 const surface=surfaceAtXZ(next.x,next.z,world.objects);
 if(!surface)return;next.y=topOf(surface);
 if(!validatePlacement(next,world.objects).ok)return;
 player.x=next.x;player.z=next.z;player.y=next.y;
 player.rotation=Math.abs(dx)>Math.abs(dz)?(dx>0?90:270):(dz>0?0:180);
 renderer.camera.target=[player.x,player.y+1,player.z];
}
function loop(){
 if(simulation)stepSimulation();
 try{
  renderer.render(simulation&&player?[...world.objects,player]:world.objects,simulation?player?.id:selectedId,ghost);
  if(activeMode==='webgl'&&!firstFrameValidated){
   const gl=renderer.gl,pixel=new Uint8Array(4);
   gl.readPixels(Math.floor(renderer.canvas.width/2),Math.floor(renderer.canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
   const error=gl.getError();
   if(error!==gl.NO_ERROR||(pixel[0]<8&&pixel[1]<8&&pixel[2]<8)){
    activateSafePreview('GPU framebuffer empty or invalid');initCanvas();
   }else firstFrameValidated=true;
  }
  if(activeMode==='webgl'&&renderer.gl.isContextLost()){
   activateSafePreview('WebGL context lost');initCanvas();
  }
 }catch(err){
  console.error('Laifu renderer error:',err);
  if(activeMode==='webgl'){
   try{activateSafePreview(err?.message||'GPU rendering failure');initCanvas();}
   catch(fallbackErr){console.error('Laifu fallback failure',fallbackErr);}
  }else{
   const status=$('floatingStatus');
   if(status){status.style.display='block';status.style.opacity='1';status.textContent='RENDER ERROR · '+String(err?.message||err).slice(0,130);}
  }
 }
 requestAnimationFrame(loop);
}

populateLevelOptions();$('gridSize').value=String(world.grid);renderer.gridSize=world.grid;initInteractions();initCanvas();renderCatalog();renderInspector();updateStatus();loop();
