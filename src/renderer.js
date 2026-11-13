import {add,mul,norm,cross,lookAt,ortho,multiply,translation,scaling,rotationY,rayFromViewport,clamp} from './math.js';
import {boxKind} from './world.js';
import {isCameraBillboard,viewForHeading} from './character-direction.js';
import {createGenesis} from './model.js';
import {groundGridSegments,surfaceGridSegments} from './grid-system.js';
import {renderCharacter,croppedSprite} from './render.js';
const VS=`attribute vec3 aPosition; attribute vec2 aUV;
uniform mat4 uMVP; varying vec2 vUV;
void main(){vUV=aUV;gl_Position=uMVP*vec4(aPosition,1.0);}`;
const FS=`precision mediump float;uniform vec4 uColor;uniform sampler2D uTexture;uniform float uHasTexture;uniform float uShade;uniform float uCharacterPlane;varying vec2 vUV;
void main(){vec4 tex=mix(vec4(1.0),texture2D(uTexture,(uCharacterPlane>0.5 && !gl_FrontFacing)?vec2(1.0-vUV.x,vUV.y):vUV),uHasTexture);vec4 col=uColor*tex;col.rgb*=uShade;if(col.a<0.06)discard;gl_FragColor=col;}`;
function shader(gl,type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function face(vertices,normal){const p=vertices;return {data:new Float32Array([...p[0],0,0,...p[1],1,0,...p[2],1,1,...p[0],0,0,...p[2],1,1,...p[3],0,1]),shade:normal};}
const faces={
front:face([[-.5,0,.5],[.5,0,.5],[.5,1,.5],[-.5,1,.5]],.82),
back:face([[.5,0,-.5],[-.5,0,-.5],[-.5,1,-.5],[.5,1,-.5]],.66),
right:face([[.5,0,.5],[.5,0,-.5],[.5,1,-.5],[.5,1,.5]],.72),
left:face([[-.5,0,-.5],[-.5,0,.5],[-.5,1,.5],[-.5,1,-.5]],.9),
top:face([[-.5,1,.5],[.5,1,.5],[.5,1,-.5],[-.5,1,-.5]],1.16),
bottom:face([[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5]],.5),
plane:face([[-.5,0,0],[.5,0,0],[.5,1,0],[-.5,1,0]],.95)
};
const hexRgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
export const ISO_YAW = Math.PI/4;
export const ISO_PITCH = Math.atan(1 / Math.sqrt(2));
export class Renderer{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false});if(!gl)throw Error('Browser ini tidak mendukung WebGL.');this.gl=gl;this.program=program(gl);gl.useProgram(this.program);this.attribP=gl.getAttribLocation(this.program,'aPosition');this.attribUV=gl.getAttribLocation(this.program,'aUV');this.unif={mvp:gl.getUniformLocation(this.program,'uMVP'),color:gl.getUniformLocation(this.program,'uColor'),shade:gl.getUniformLocation(this.program,'uShade'),tex:gl.getUniformLocation(this.program,'uTexture'),has:gl.getUniformLocation(this.program,'uHasTexture'),character:gl.getUniformLocation(this.program,'uCharacterPlane')};gl.uniform1i(this.unif.tex,0);this.faceBuffers={};for(const [k,v] of Object.entries(faces)){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,v.data,gl.STATIC_DRAW);this.faceBuffers[k]=b;}
 this.textureCache=new Map();this.procedural={};this.white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));this.setupTex();
 this.camera={target:[0,0,0],yaw:ISO_YAW,pitch:ISO_PITCH,distance:40,ortho:true};this.viewProjection=null;this.eye=null;this.gridOn=true;this.showLabels=true;this.time=9;this.gridBuffer=gl.createBuffer();this.surfaceGridBuffer=gl.createBuffer();this.gridCount=0;this.gridSize=80;this.gridStep=1;this.buildGrid();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}
 setupTex(){const gl=this.gl;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
 texture(url){if(!url)return null;if(this.textureCache.has(url))return this.textureCache.get(url);const gl=this.gl,tex=gl.createTexture(),entry={tex,ready:false};this.textureCache.set(url,entry);const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);this.setupTex();entry.ready=true;};img.onerror=()=>{this.textureCache.delete(url);gl.deleteTexture(tex);};img.src=url;return entry;}
 buildGrid(){
  const segments=groundGridSegments(this.gridStep,this.gridSize);
  const coords=[];for(const [a,b]of segments)coords.push(...a,...b);
  this.gridCount=coords.length/3;
  const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.gridBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coords),gl.STATIC_DRAW);
 }
 setGridStep(step){this.gridStep=step;this.buildGrid();}
 resize(){const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.floor(this.canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(this.canvas.clientHeight*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);}
 matrices(){this.resize();const c=this.camera;c.yaw=ISO_YAW;c.pitch=ISO_PITCH;c.ortho=true;const horiz=Math.cos(c.pitch)*c.distance;this.eye=[c.target[0]+Math.sin(c.yaw)*horiz,c.target[1]+Math.sin(c.pitch)*c.distance,c.target[2]+Math.cos(c.yaw)*horiz];const view=lookAt(this.eye,c.target);const aspect=this.canvas.width/this.canvas.height;const span=c.distance*.55;const proj=ortho(-span*aspect,span*aspect,-span,span,.1,900);this.viewProjection=multiply(proj,view);return this.viewProjection;}
 screenRay(x,y){this.matrices();return rayFromViewport(x,y,this.canvas.getBoundingClientRect(),this.viewProjection);}
 drawFace(key,mvp,col,alpha,texture,brightness=1,isCharacter=false){const gl=this.gl,p=this.faceBuffers[key];gl.bindBuffer(gl.ARRAY_BUFFER,p);gl.enableVertexAttribArray(this.attribP);gl.enableVertexAttribArray(this.attribUV);gl.vertexAttribPointer(this.attribP,3,gl.FLOAT,false,20,0);gl.vertexAttribPointer(this.attribUV,2,gl.FLOAT,false,20,12);gl.uniformMatrix4fv(this.unif.mvp,false,new Float32Array(mvp));gl.uniform4f(this.unif.color,col[0],col[1],col[2],alpha);gl.uniform1f(this.unif.shade,(faces[key]?.shade||1)*brightness);gl.uniform1f(this.unif.character,isCharacter?1:0);const cache=this.texture(texture);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,cache?.ready?cache.tex:this.white);gl.uniform1f(this.unif.has,cache?.ready?1:0);gl.drawArrays(gl.TRIANGLES,0,6);}
 modelMatrix(o,billboard=false){const rot=billboard?this.camera.yaw:(o.rotation||0)*Math.PI/180;const s=scaling(o.width,o.height,o.depth||1);return multiply(translation(o.x,o.y,o.z),multiply(rotationY(rot),s));}
 generatedPlane(kind,direction='front'){
 const cacheKey=kind+':'+direction;
 if(this.procedural[cacheKey])return this.procedural[cacheKey];
 if(kind==='character'){
  this.genesisTemplate??=createGenesis();
  const canvas=croppedSprite(renderCharacter(this.genesisTemplate,direction)).canvas;
  this.procedural[cacheKey]=canvas.toDataURL('image/png');
  return this.procedural[cacheKey];
 }
 const c=document.createElement('canvas');c.width=64;c.height=128;const ctx=c.getContext('2d');ctx.clearRect(0,0,64,128);if(kind==='tree'){ctx.fillStyle='#765945';ctx.fillRect(26,74,13,50);ctx.fillStyle='#5c926f';ctx.beginPath();ctx.ellipse(32,48,28,43,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8abd94';ctx.beginPath();ctx.ellipse(25,36,16,27,-.2,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle='#364e70';ctx.beginPath();ctx.arc(32,20,12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(23,39);ctx.lineTo(41,39);ctx.lineTo(47,79);ctx.lineTo(40,79);ctx.lineTo(39,124);ctx.lineTo(32,124);ctx.lineTo(31,85);ctx.lineTo(27,124);ctx.lineTo(20,124);ctx.lineTo(21,79);ctx.lineTo(17,79);ctx.closePath();ctx.fill();ctx.fillStyle='#98b2d3';ctx.fillRect(23,44,17,21);}this.procedural[cacheKey]=c.toDataURL('image/png');return this.procedural[cacheKey];}
 drawObject(o,selected=false,ghost=false){
 const plane=!boxKind(o.kind),billboard=isCameraBillboard(o.kind);
 // Characters use their world rotation, never the camera yaw. Trees billboard.
 const m=this.modelMatrix(o,billboard),mvp=multiply(this.viewProjection,m);
 let color=hexRgb(o.color||'#aaaaaa');
 if(selected)color=color.map(v=>Math.min(1,v*1.17+.06));
 if(ghost)color=color.map(v=>Math.min(1,v*.8+.2));
 const alpha=ghost?.43:(o.alpha??1);
 const facesToDraw=plane?['plane']:['front','back','right','left','top','bottom'];
 for(const face of facesToDraw){
  let texture=o.textures?.[face]||null;
  if(o.kind==='character'){
   const view=viewForHeading(o.rotation);
   texture=o.textures?.[view]||o.textures?.plane||this.generatedPlane('character',view);
  }else if(plane){
   texture=texture||this.generatedPlane(o.kind);
  }
  this.drawFace(face,mvp,color,alpha,texture,selected?1.05:1,o.kind==='character');
 }
}
 drawGrid(){if(!this.gridOn)return;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.gridBuffer);gl.enableVertexAttribArray(this.attribP);gl.vertexAttribPointer(this.attribP,3,gl.FLOAT,false,12,0);gl.disableVertexAttribArray(this.attribUV);gl.vertexAttrib2f(this.attribUV,0,0);gl.uniformMatrix4fv(this.unif.mvp,false,new Float32Array(this.viewProjection));gl.uniform4f(this.unif.color,.18,.37,.52,.65);gl.uniform1f(this.unif.has,0);gl.uniform1f(this.unif.shade,1);gl.uniform1f(this.unif.character,0);gl.drawArrays(gl.LINES,0,this.gridCount);}
 drawSurfaceGrid(objects){
  if(!this.gridOn)return;
  const coords=[];
  for(const o of objects)for(const [a,b]of surfaceGridSegments(o,this.gridStep))coords.push(...a,...b);
  if(!coords.length)return;
  const gl=this.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER,this.surfaceGridBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coords),gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(this.attribP);
  gl.vertexAttribPointer(this.attribP,3,gl.FLOAT,false,12,0);
  gl.disableVertexAttribArray(this.attribUV);
  gl.vertexAttrib2f(this.attribUV,0,0);
  gl.uniformMatrix4fv(this.unif.mvp,false,new Float32Array(this.viewProjection));
  gl.uniform4f(this.unif.color,.13,.28,.36,.52);
  gl.uniform1f(this.unif.has,0);
  gl.uniform1f(this.unif.shade,1);
  gl.uniform1f(this.unif.character,0);
  gl.drawArrays(gl.LINES,0,coords.length/3);
 }
 drawPlaneBase(){this.drawObject({kind:'platform',x:0,z:0,y:-.19,width:160,depth:160,height:.17,color:'#dce8db',alpha:1,textures:{}},false,false);}
 render(objects,selectedId,ghost){const gl=this.gl;this.matrices();const light=clamp((Math.cos((this.time-12)/12*Math.PI)+1)/2,.15,1);gl.clearColor(.59*light+.14,.71*light+.13,.81*light+.1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.drawPlaneBase();this.drawGrid();const opaque=objects.filter(o=>(o.alpha??1)>.98),translucent=objects.filter(o=>(o.alpha??1)<=.98);for(const o of opaque)this.drawObject(o,o.id===selectedId);this.drawSurfaceGrid(objects);gl.depthMask(false);for(const o of translucent)this.drawObject(o,o.id===selectedId);if(ghost)this.drawObject(ghost,false,true);gl.depthMask(true);}
 orbit(_dx,_dy){/* Fixed isometric camera: orbit intentionally disabled. */}
 pan(dx,dy){const c=this.camera,s=c.distance*.0016;const right=[Math.cos(c.yaw),0,-Math.sin(c.yaw)],forward=[-Math.sin(c.yaw),0,-Math.cos(c.yaw)];c.target=add(c.target,add(mul(right,-dx*s),mul(forward,dy*s)));}
 zoom(delta){this.camera.distance=clamp(this.camera.distance*Math.exp(delta*.0013),8,150);}
 focus(o){this.camera.target=[o?.x||0,(o?.y||0)+(o?.height||0)/3,o?.z||0];}
 fit(){this.camera.target=[0,0,0];this.camera.distance=40;this.camera.yaw=ISO_YAW;this.camera.pitch=ISO_PITCH;this.camera.ortho=true;}
}
