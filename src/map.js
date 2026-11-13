import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createGenesis} from './model.js';
import {createCharacterPlane,placeCharacterPlane,faceCharacterPlaneToCamera} from './plane.js';
import {loadCharacterFile} from './format.js';
import {LAIFU_SCALE} from './constants.js';
let character=createGenesis(),view='front',level=0;
const app=document.querySelector('#app');
app.innerHTML=`<div class="app map-app"><header class="top"><div><div class="logo">LAIFU <span>MAP TEST</span></div><div class="brand-sub">3D world + 2D character planes</div></div><div class="top-middle"><a class="btn" style="text-decoration:none" href="../laifu-character/">✎ Character Editor</a><button id="import" class="btn">Import Character ZIP / JSON</button><input id="file" type="file" hidden accept=".json,.zip"><label class="field" style="max-width:110px">Placement Level<select id="level"><option value="0">Ground · 0</option><option value="1">Level 1 · +4</option><option value="2">Level 2 · +8</option></select></label><label class="field" style="max-width:104px">View<select id="view"><option>front</option><option>left</option><option>right</option><option>back</option></select></label></div></header>
 <div class="map-wrap" id="map-wrap"><div class="map-hud"><h3>Laifu Map · Placement Test</h3><p>Tap / klik permukaan untuk menaruh karakter pada level terpilih. Drag untuk pan, scroll/pinch untuk zoom. Kamera ISO terkunci.</p><p><span class="legend">✓</span> Genesis character = <b>2 unit / 1 pintu</b><br><span class="legend">✓</span> Platform Level 1 = <b>+4 unit</b><br><span class="legend">✓</span> Bangunan minimum = <b>4 unit</b></p><p id="info">Default Genesis · Male</p></div></div>
 <footer class="footer">Map ini adalah integration test di repo Laifu baru, bukan pengganti scene Semesta · Import manual dari Laifu Character ZIP atau JSON · Tidak ada autosave</footer></div>`;
const wrap=document.querySelector('#map-wrap'),scene=new THREE.Scene();scene.background=new THREE.Color('#aebfd0');
const camera=new THREE.OrthographicCamera(-9,9,6,-6,.1,250);camera.position.set(12,13,12);camera.lookAt(0,1,0);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));wrap.append(renderer.domElement);renderer.domElement.style.touchAction='none';
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.enableDamping=true;controls.enableRotate=false;controls.enablePan=true;controls.minZoom=.35;controls.maxZoom=5;controls.maxPolarAngle=Math.PI*.47;controls.update();
scene.add(new THREE.HemisphereLight('#ffffff','#7c8791',2.2));
const addBox=(w,h,d,x,y,z,color)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));o.position.set(x,y,z);scene.add(o);return o;};
const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshLambertMaterial({color:'#879a91'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;scene.add(ground);
const grid=new THREE.GridHelper(42,42,'#65766f','#8ca096');grid.position.y=.002;scene.add(grid);
addBox(4,3.9,4,-3,1.95,-3,'#6d8585'); // body ends at Y=1.9, cap ends exactly at Y=2
addBox(2.1,LAIFU_SCALE.minBuildingHeight,2.1,3,LAIFU_SCALE.minBuildingHeight/2,-2,'#c2a984'); // min building = 2
const door=addBox(.7,LAIFU_SCALE.doorUnits,.08,3,LAIFU_SCALE.doorUnits/2,-.90,'#283c55');door.userData.kind='door';
const stepTop=addBox(4,.10,4,-3,3.95,-3,'#698c96'); // top surface exactly Y=2
const rulerGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(5,0,1),new THREE.Vector3(5,4,1)]);const ruler=new THREE.Line(rulerGeometry,new THREE.LineBasicMaterial({color:'#e8f0b2'}));scene.add(ruler);
for(let n=3;n<=20;n++){const op=document.createElement('option');op.value=String(n);op.textContent=`Level ${n} · +${n*LAIFU_SCALE.levelHeight}`;document.querySelector('#level').append(op);}
const chars=[];function addChar(x,z,lv=0){const mesh=createCharacterPlane(character,view);placeCharacterPlane(mesh,x,z,lv);mesh.renderOrder=4;scene.add(mesh);chars.push(mesh);return mesh;}
addChar(0,1,0);addChar(-3,-3,1);
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight||500;renderer.setSize(w,h,false);const aspect=w/h;camera.left=-7.6*aspect;camera.right=7.6*aspect;camera.top=7.6;camera.bottom=-7.6;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(wrap);resize();
function animate(){requestAnimationFrame(animate);controls.update();for(const c of chars)faceCharacterPlaneToCamera(c,camera);renderer.render(scene,camera);}animate();
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let clickStart=null;
renderer.domElement.addEventListener('pointerdown',e=>{clickStart={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{if(!clickStart||Math.hypot(e.clientX-clickStart.x,e.clientY-clickStart.y)>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);ray.setFromCamera(pointer,camera);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-level*LAIFU_SCALE.levelHeight);const p=new THREE.Vector3();if(ray.ray.intersectPlane(plane,p)){addChar(Math.round(p.x*2)/2,Math.round(p.z*2)/2,level);document.querySelector('#info').textContent=`${character.name} · ${character.genesis} · ${chars.length} plane(s)`;}});
const updateCharViews=()=>{const prev=chars.map(x=>({x:x.position.x,z:x.position.z,lv:x.userData.level}));for(const c of chars){scene.remove(c);c.material.map.dispose();c.material.dispose();c.geometry.dispose();}chars.length=0;for(const p of prev)addChar(p.x,p.z,p.lv);};
document.querySelector('#import').onclick=()=>document.querySelector('#file').click();
document.querySelector('#file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{character=await loadCharacterFile(f);updateCharViews();document.querySelector('#info').textContent=`Imported: ${character.name} · ${character.genesis} · ${chars.length} plane(s)`;}catch(err){alert('Import gagal: '+err.message);}finally{e.target.value='';}};
document.querySelector('#view').onchange=e=>{view=e.target.value;updateCharViews();};
document.querySelector('#level').onchange=e=>{level=Number(e.target.value);};
