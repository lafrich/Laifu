import './style.css';
import './emosi.css';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {FRAME,VIEWS,PALETTE} from './constants.js';
import {createGenesis} from './model.js';
import {drawCharacter} from './render.js';
import {loadCharacterFile,saveBlob,filename} from './format.js';
import {EMOTION_FORMAT,EMOTION_DATABASE_FORMAT,EMOTION_MAX_FRAMES,createEmotion,createEmotionDatabase,normalizeEmotionDatabase,paintPixel,fillRegion,copyFrame,moveFrame,flipFrame,insertFrame,deleteFrame,reorderFrames,drawEmotionFrame,textToConvoTimeline} from './emotion.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=createEmotionDatabase(),selectedId=db.emotions[0].id,view='front',frame=0,tool='brush',zoom=5,grid=true,guide=true;
let previewBody=createGenesis(),color='#29313f',clipboard=null,selection=null,drag=null;
let dirty=false,lastExport='',playing=false,playAt=0,lastTick=0,convoTimeline=[],convoPos=0,convoRemaining=0;
const history=[JSON.stringify(db)];let historyAt=0;
const emotion=()=>db.emotions.find(e=>e.id===selectedId)||db.emotions[0]||null;
const frameData=()=>emotion()?.views[view]?.frames?.[frame];
function toast(message){const el=$('emosiToast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2800);}
function markDirty(){dirty=true;$('emosiStatus').textContent='● BELUM DIEKSPOR';$('emosiStatus').style.color='#ffcf99';}
function snapshot(){const now=JSON.stringify(db);if(now===history[historyAt])return;history.splice(historyAt+1);history.push(now);if(history.length>60)history.shift();historyAt=history.length-1;markDirty();updateUndo();}
function restore(offset){const index=historyAt+offset;if(index<0||index>=history.length)return;historyAt=index;db=JSON.parse(history[index]);selectedId=db.activeEmotionId||db.emotions[0]?.id;frame=Math.min(frame,(emotion()?.frameCount||1)-1);markDirty();renderAll();}
function updateUndo(){$('emoUndo').disabled=historyAt===0;$('emoRedo').disabled=historyAt>=history.length-1;}
function setEmotion(id){selectedId=id;db.activeEmotionId=id;frame=0;playing=false;convoTimeline=[];selection=null;renderAll();}
function renderLibrary(){
 const root=$('emoLibrary'),query=$('emoSearch').value.toLowerCase().trim();root.replaceChildren();
 for(const e of db.emotions.filter(x=>!query||x.name.toLowerCase().includes(query))){
  const btn=document.createElement('button');btn.type='button';btn.className='emo-item'+(e.id===selectedId?' selected':'');
  btn.innerHTML='<strong>'+esc(e.name)+'</strong><small>'+e.frameCount+' frames · '+e.fps+' FPS · '+(e.loop?'loop':'once')+'</small>';
  btn.onclick=()=>setEmotion(e.id);root.append(btn);
 }
 $('emoCount').textContent=db.emotions.length;
}
function renderViews(){const el=$('emoViews');el.replaceChildren();
 for(const v of VIEWS){const btn=document.createElement('button');btn.type='button';btn.className='btn small-btn'+(v===view?' active':'');btn.textContent=v.toUpperCase();btn.onclick=()=>{view=v;selection=null;frame=Math.min(frame,emotion().frameCount-1);renderAll();};el.append(btn);}
}
function renderTimeline(){
 const e=emotion(),root=$('emoTimeline');root.replaceChildren();if(!e)return;
 for(let i=0;i<e.frameCount;i++){
  const btn=document.createElement('button');btn.type='button';btn.className='emo-frame'+(i===frame?' active':'');
  const pixels=Object.keys(e.views[view].frames[i].pixels).length;
  btn.innerHTML='<span>F'+String(i+1).padStart(2,'0')+'</span><small>'+pixels+' px</small>';
  btn.onclick=()=>{frame=i;playing=false;renderTimeline();draw();};root.append(btn);
 }
 $('emoFrameCount').textContent=e.frameCount+'/'+EMOTION_MAX_FRAMES;
 $('emoFrameLabel').textContent=String(frame+1)+'/'+e.frameCount;
}
const canvas=$('emoCanvas'),preview=$('emoPreview');
function checker(ctx){for(let y=0;y<FRAME.height;y+=8)for(let x=0;x<FRAME.width;x+=8){ctx.fillStyle=(x/8+y/8)%2?'#253242':'#344251';ctx.fillRect(x,y,8,8);}}
function draw(){
 const e=emotion();if(!e)return;
 const ctx=canvas.getContext('2d');
 canvas.width=FRAME.width*zoom;canvas.height=FRAME.height*zoom;canvas.style.width=canvas.width+'px';canvas.style.height=canvas.height+'px';
 ctx.imageSmoothingEnabled=false;ctx.scale(zoom,zoom);checker(ctx);
 if(guide){ctx.save();ctx.globalAlpha=.64;drawCharacter(ctx,previewBody,view);ctx.restore();}
 drawEmotionFrame(ctx,e,view,frame);
 if(grid){ctx.save();ctx.strokeStyle='rgba(240,248,255,.13)';ctx.lineWidth=1/zoom;
  for(let x=0;x<=FRAME.width;x++){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,FRAME.height);ctx.stroke();}
  for(let y=0;y<=FRAME.height;y++){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(FRAME.width,y);ctx.stroke();}
  ctx.restore();
 }
 // Anchor guide uses the current Genesis head bone, never a face bone.
 const head=previewBody.views[view].parts.find(p=>p.id==='head');
 if(head){ctx.strokeStyle='#93e2a7';ctx.lineWidth=.9/zoom;ctx.strokeRect(head.pivot[0]-1,head.pivot[1]-1,2,2);}
 if(selection){ctx.strokeStyle='#ffcc79';ctx.lineWidth=1/zoom;ctx.setLineDash([2,2]);ctx.strokeRect(selection.x,selection.y,selection.w,selection.h);ctx.setLineDash([]);}
 const p=preview.getContext('2d');p.setTransform(1,0,0,1,0,0);p.clearRect(0,0,preview.width,preview.height);p.imageSmoothingEnabled=false;
 p.fillStyle='#263549';p.fillRect(0,0,preview.width,preview.height);
 p.save();p.scale(preview.width/FRAME.width,preview.height/FRAME.height);
 drawCharacter(p,previewBody,view);drawEmotionFrame(p,e,view,frame);p.restore();
 $('emoFrameLabel').textContent=String(frame+1)+'/'+e.frameCount;
}
function renderInspector(){
 const e=emotion();if(!e)return;
 $('emoName').value=e.name;$('emoFps').value=e.fps;$('emoLoop').checked=e.loop;
 const pos=e.placement[view];$('emoX').value=pos.x;$('emoY').value=pos.y;$('emoScale').value=pos.scale;$('emoEnabled').checked=pos.enabled;
 $('emoActive').textContent=e.name.toUpperCase();$('emoZoom').textContent=zoom*100+'%';
 const selectedTool=document.querySelectorAll('[data-emo-tool]');for(const btn of selectedTool)btn.classList.toggle('active',btn.dataset.emoTool===tool);
}
function renderAll(){renderLibrary();renderViews();renderTimeline();renderInspector();updateUndo();draw();}
function point(e){
 const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*FRAME.width/r.width,y=(e.clientY-r.top)*FRAME.height/r.height;
 const place=emotion().placement[view],scale=place.scale||1;
 return {x:Math.floor(32+(x-32-place.x)/scale),y:Math.floor(32+(y-32-place.y)/scale)};
}
function within(p){return p.x>=0&&p.x<FRAME.width&&p.y>=0&&p.y<FRAME.height;}
function stroke(p){if(!within(p))return;
 if(tool==='brush'||tool==='eraser')paintPixel(emotion(),view,frame,p.x,p.y,tool==='brush'?color:null);
 else if(tool==='fill')fillRegion(emotion(),view,frame,p.x,p.y,color);
 draw();
}
canvas.addEventListener('pointerdown',e=>{
 e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=point(e);
 drag={last:p,start:p,previous:JSON.stringify(db),type:tool};
 if(['brush','eraser','fill'].includes(tool))stroke(p);
 else if(tool==='select'&&within(p)){selection={x:p.x,y:p.y,w:1,h:1};draw();}
});
canvas.addEventListener('pointermove',e=>{
 if(!drag)return;const p=point(e),last=drag.last;
 if(tool==='brush'||tool==='eraser'){
  const steps=Math.max(Math.abs(p.x-last.x),Math.abs(p.y-last.y),1);
  for(let i=1;i<=steps;i++){const x=Math.round(last.x+(p.x-last.x)*i/steps),y=Math.round(last.y+(p.y-last.y)*i/steps);stroke({x,y});}
 }else if(tool==='move'){
  const dx=p.x-last.x,dy=p.y-last.y;if(dx||dy){moveFrame(emotion(),view,frame,dx,dy);draw();}
 }else if(tool==='select'){
  const st=drag.start;selection={x:Math.min(st.x,p.x),y:Math.min(st.y,p.y),w:Math.abs(st.x-p.x)+1,h:Math.abs(st.y-p.y)+1};draw();
 }
 drag.last=p;
});
function endDrag(){if(!drag)return;const changed=drag.previous!==JSON.stringify(db);drag=null;if(changed){snapshot();renderTimeline();}}
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(2,Math.min(9,zoom+(e.deltaY<0?1:-1)));$('emoZoom').textContent=zoom*100+'%';draw();},{passive:false});
function copyPixels(){
 const b=selection||{x:0,y:0,w:64,h:112},items=[];
 for(const [pos,c] of Object.entries(frameData().pixels)){
  const [x,y]=pos.split(',').map(Number);if(x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h)items.push([x-b.x,y-b.y,c]);
 }
 clipboard={items,x:b.x,y:b.y,w:b.w,h:b.h};toast(items.length+' pixel disalin');
}
function pastePixels(flip=false){if(!clipboard)return toast('Copy pixel terlebih dahulu');
 for(const [x,y,c] of clipboard.items)paintPixel(emotion(),view,frame,clipboard.x+(flip?clipboard.w-1-x:x),clipboard.y+y,c);
 snapshot();renderAll();
}
for(const btn of document.querySelectorAll('[data-emo-tool]'))btn.onclick=()=>{tool=btn.dataset.emoTool;renderInspector();};
$('emoUndo').onclick=()=>restore(-1);$('emoRedo').onclick=()=>restore(1);
$('emoCopy').onclick=copyPixels;$('emoPaste').onclick=()=>pastePixels();$('emoPasteFlip').onclick=()=>pastePixels(true);
$('emoFlip').onclick=()=>{flipFrame(emotion(),view,frame);snapshot();renderAll();};
$('emoGrid').onchange=e=>{grid=e.target.checked;draw();};$('emoGuide').onchange=e=>{guide=e.target.checked;draw();};
$('emoZoomOut').onclick=()=>{zoom=Math.max(2,zoom-1);renderInspector();draw();};
$('emoZoomIn').onclick=()=>{zoom=Math.min(9,zoom+1);renderInspector();draw();};
$('emoColor').oninput=e=>{color=e.target.value;};
const swatches=['#29313f','#713f37','#54303a','#ffffff','#9c6c51','#de9a78','#edbb93','#d35e6a','#7b4fa3','#537aab','#222222','#f7d5b2'];
for(const c of swatches){const b=document.createElement('button');b.type='button';b.className='emo-swatch';b.style.background=c;b.title=c;b.onclick=()=>{color=c;$('emoColor').value=c;};$('emoSwatches').append(b);}
$('emoSearch').oninput=renderLibrary;
$('emoNew').onclick=()=>{const e=createEmotion('New Emotion');db.emotions.push(e);selectedId=e.id;db.activeEmotionId=e.id;frame=0;snapshot();renderAll();};
$('emoDuplicate').onclick=()=>{const e=emotion();if(!e)return;const copy=JSON.parse(JSON.stringify(e));copy.id='copy_'+Math.random().toString(36).slice(2);copy.name=e.name+' Copy';db.emotions.push(copy);selectedId=copy.id;db.activeEmotionId=copy.id;frame=0;snapshot();renderAll();};
$('emoDelete').onclick=()=>{if(db.emotions.length<=1)return toast('Harus ada minimal satu emosi');const e=emotion();if(!confirm('Hapus '+e.name+' dari database sementara?'))return;db.emotions=db.emotions.filter(x=>x.id!==e.id);selectedId=db.emotions[0].id;db.activeEmotionId=selectedId;frame=0;snapshot();renderAll();};
$('emoName').onchange=e=>{emotion().name=e.target.value.trim().slice(0,70)||'Emotion';snapshot();renderAll();};
$('emoFps').onchange=e=>{emotion().fps=Math.max(1,Math.min(30,Math.round(Number(e.target.value)||12)));snapshot();renderAll();};
$('emoLoop').onchange=e=>{emotion().loop=e.target.checked;snapshot();renderAll();};
for(const input of ['emoX','emoY','emoScale','emoEnabled']){
 $(input).addEventListener('input',e=>{
  const p=emotion().placement[view];
  if(input==='emoEnabled')p.enabled=e.target.checked;
  else if(input==='emoScale')p.scale=Math.max(.25,Math.min(3,Number(e.target.value)||1));
  else if(input==='emoX')p.x=Math.max(-24,Math.min(24,Number(e.target.value)||0));
  else if(input==='emoY')p.y=Math.max(-24,Math.min(24,Number(e.target.value)||0));
  draw();
 });
 $(input).addEventListener('change',()=>{snapshot();renderInspector();});
}
$('emoAddFrame').onclick=()=>{if(!insertFrame(emotion(),frame+1))return toast('Maksimal 48 frame');frame++;snapshot();renderAll();};
$('emoDupFrame').onclick=()=>{if(!insertFrame(emotion(),frame+1,true))return toast('Maksimal 48 frame');frame++;snapshot();renderAll();};
$('emoRemoveFrame').onclick=()=>{if(!deleteFrame(emotion(),frame))return toast('Minimal 1 frame');frame=Math.min(frame,emotion().frameCount-1);snapshot();renderAll();};
$('emoPrevFrame').onclick=()=>{if(frame===0)return;reorderFrames(emotion(),frame,frame-1);frame--;snapshot();renderAll();};
$('emoNextFrame').onclick=()=>{if(frame>=emotion().frameCount-1)return;reorderFrames(emotion(),frame,frame+1);frame++;snapshot();renderAll();};
$('emoPlay').onclick=()=>{playing=!playing;convoTimeline=[];$('emoPlay').textContent=playing?'■ Stop':'▶ Play';};
$('emoConvo').onclick=()=>{
 convoTimeline=textToConvoTimeline($('emoText').value,emotion().frameCount);convoPos=0;convoRemaining=0;playing=true;
 $('emoPlay').textContent='■ Stop';renderConvo();toast('Convo timeline dibuat dari frame yang kamu gambar');
};
function renderConvo(){
 const root=$('emoConvoTimeline');root.replaceChildren();convoTimeline.slice(0,90).forEach((t,i)=>{const chip=document.createElement('span');chip.className='emo-syllable';chip.textContent=(t.letter===' '?'␣':t.letter)+' / F'+(t.frame+1);if(i===convoPos)chip.classList.add('on');root.append(chip);});
 $('emoConvoCount').textContent=convoTimeline.length+' units';
}
function animationTick(time){
 const e=emotion();
 if(playing&&e&&time-lastTick>=1000/e.fps){
  lastTick=time;
  if(convoTimeline.length){
   if(convoRemaining<=0){if(convoPos>=convoTimeline.length){if(e.loop)convoPos=0;else{playing=false;convoTimeline=[];}}
    if(playing){const step=convoTimeline[convoPos];frame=step.frame;convoRemaining=step.ticks;convoPos++;renderConvo();}
   }convoRemaining--;
  }else if(frame>=e.frameCount-1){if(e.loop)frame=0;else playing=false;}
  else frame++;
  $('emoPlay').textContent=playing?'■ Stop':'▶ Play';
  renderTimeline();draw();
 }
 requestAnimationFrame(animationTick);
}
requestAnimationFrame(animationTick);
async function pngBytes(canvas){const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Gagal menulis PNG')),'image/png'));return new Uint8Array(await blob.arrayBuffer());}
function faceSheet(e,v){
 const c=document.createElement('canvas');c.width=FRAME.width*e.frameCount;c.height=FRAME.height;
 const cx=c.getContext('2d');cx.imageSmoothingEnabled=false;
 for(let i=0;i<e.frameCount;i++){cx.save();cx.translate(i*FRAME.width,0);drawEmotionFrame(cx,e,v,i);cx.restore();}
 return c;
}
async function exportDb(asZip){
 const safe=normalizeEmotionDatabase(db),body=JSON.stringify(safe,null,2);
 if(!asZip)saveBlob(new Blob([body],{type:'application/json'}),'laifu-emosi-database.json');
 else{
  const entries={'database.json':strToU8(body),'README.txt':strToU8('Laifu Emosi / full-face 64x112 overlay, 4 world directions. Anchor: Genesis HEAD bone. Each sheet is Nx64 by 112 pixels, frames ordered left-to-right. No automatic sync.\n')};
  for(const e of safe.emotions)for(const v of VIEWS)entries['views/'+filename(e.id)+'/'+v+'.png']=await pngBytes(faceSheet(e,v));
  saveBlob(new Blob([zipSync(entries,{level:6})],{type:'application/zip'}),'laifu-emosi-database.zip');
 }
 dirty=false;lastExport=new Date().toISOString();$('emosiStatus').textContent='✓ EXPORTED MANUALLY';$('emosiStatus').style.color='#a3dfb9';
 toast(asZip?'Database JSON + sprite sheets ZIP diekspor':'Database JSON diekspor');
}
$('emoExport').onclick=async()=>{try{await exportDb(false);}catch(err){toast(err.message);}};
$('emoExportZip').onclick=async()=>{try{await exportDb(true);}catch(err){toast(err.message);}};
$('emoImport').onclick=()=>$('emoImportFile').click();
$('emoImportFile').onchange=async ev=>{
 const f=ev.target.files?.[0];if(!f)return;
 if(dirty&&!confirm('Perubahan belum diekspor, lanjut import dan ganti database?')){ev.target.value='';return;}
 try{
  let json;
  if(f.name.toLowerCase().endsWith('.zip')){const data=unzipSync(new Uint8Array(await f.arrayBuffer()));json=JSON.parse(strFromU8(data['database.json']||data['emotion.json']));}
  else json=JSON.parse(await f.text());
  db=normalizeEmotionDatabase(json);if(!db.emotions.length)db=createEmotionDatabase();
  selectedId=db.activeEmotionId||db.emotions[0].id;frame=0;convoTimeline=[];playing=false;history.splice(0,history.length,JSON.stringify(db));historyAt=0;dirty=false;
  $('emosiStatus').textContent='Imported / manual export required';renderAll();toast('Database Emosi dimuat');
 }catch(err){toast('Import gagal: '+err.message);}finally{ev.target.value='';}
};
$('emoImportGenesis').onclick=()=>$('emoGenesisFile').click();
$('emoGenesisFile').onchange=async ev=>{const f=ev.target.files?.[0];if(!f)return;try{previewBody=await loadCharacterFile(f);renderAll();toast('Genesis head guide: '+previewBody.name);}catch(err){toast('Genesis import gagal: '+err.message);}finally{ev.target.value='';}};
window.addEventListener('keydown',event=>{
 if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();restore(-1);}
 else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();restore(1);}
 else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'){event.preventDefault();copyPixels();}
 else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='v'){event.preventDefault();pastePixels(event.shiftKey);}
 else if(['b','e','f','s','m'].includes(event.key.toLowerCase())){tool={b:'brush',e:'eraser',f:'fill',s:'select',m:'move'}[event.key.toLowerCase()];renderInspector();}
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
renderAll();
