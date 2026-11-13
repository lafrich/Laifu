import {add,mul,lookAt,ortho,multiply,transformPoint,rayFromViewport,clamp} from './math.js';
import {ISO_YAW,ISO_PITCH} from './renderer.js';
import {boxKind} from './world.js';

// CPU-only isometric fallback. Preserves X/Y/Z, object dimensions, and placement rays.
export class CanvasIsoRenderer {
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
  if(!this.ctx)throw Error('Canvas 2D tidak tersedia');
  this.camera={target:[0,0,0],yaw:ISO_YAW,pitch:ISO_PITCH,distance:40,ortho:true};
  this.gridOn=true;this.time=9;this.fallback=true;
 }
 matrices(){
  const ratio=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(this.canvas.clientWidth*ratio)),h=Math.max(1,Math.round(this.canvas.clientHeight*ratio));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  const c=this.camera,dist=c.distance,yaw=ISO_YAW,pitch=ISO_PITCH,horizontal=Math.cos(pitch)*dist;
  c.yaw=yaw;c.pitch=pitch;c.ortho=true;
  this.eye=[c.target[0]+Math.sin(yaw)*horizontal,c.target[1]+Math.sin(pitch)*dist,c.target[2]+Math.cos(yaw)*horizontal];
  const span=dist*.55;
  this.projection=multiply(ortho(-span*w/h,span*w/h,-span,span,.1,900),lookAt(this.eye,c.target));
  return this.projection;
 }
 project(p){const v=transformPoint(this.projection,p);return [(v[0]+1)*this.canvas.width/2,(1-v[1])*this.canvas.height/2];}
 screenRay(x,y){this.matrices();return rayFromViewport(x,y,this.canvas.getBoundingClientRect(),this.projection);}
 path(vertices,fill,stroke,alpha=1){
  const ctx=this.ctx;ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();
  vertices.forEach((v,i)=>{const p=this.project(v);i?ctx.lineTo(...p):ctx.moveTo(...p);});
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.lineWidth=1.5;ctx.strokeStyle=stroke;ctx.stroke();}
  ctx.restore();
 }
 point(o,x,y,z){const r=(o.kind==='tree'||o.kind==='character'?ISO_YAW:(o.rotation||0)*Math.PI/180),c=Math.cos(r),s=Math.sin(r);return [o.x+x*c+z*s,o.y+y,o.z-x*s+z*c];}
 shade(hex,scale){const n=parseInt((hex||'#879aab').slice(1),16);const rgb=[(n>>16)&255,(n>>8)&255,n&255].map(x=>Math.max(0,Math.min(255,Math.round(x*scale))));return 'rgb('+rgb.join(',')+')';}
 faces(o,selected=false,ghost=false){
  const x=o.width/2,z=o.depth/2,y=o.height;
  const groups=boxKind(o.kind)?[
    [[[-x,0,z],[x,0,z],[x,y,z],[-x,y,z]],.88],
    [[[x,0,-z],[-x,0,-z],[-x,y,-z],[x,y,-z]],.73],
    [[[-x,0,-z],[-x,0,z],[-x,y,z],[-x,y,-z]],.92],
    [[[x,0,z],[x,0,-z],[x,y,-z],[x,y,z]],.76],
    [[[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]],1.06],
  ]:[
    [[[-x,0,0],[x,0,0],[x,y,0],[-x,y,0]],1]
  ];
  return groups.map(([coords,brightness])=>{
   const verts=coords.map(v=>this.point(o,...v));
   const center=verts.reduce((a,v)=>add(a,v),[0,0,0]).map(v=>v/4);
   const distance=(center[0]-this.eye[0])**2+(center[1]-this.eye[1])**2+(center[2]-this.eye[2])**2;
   return {verts,distance,fill:this.shade(o.color,brightness),stroke:selected?'#ffd34a':'rgba(20,45,55,.17)',alpha:ghost?.42:(o.alpha??1),plane:!boxKind(o.kind),kind:o.kind};
  });
 }
 render(objects,selectedId,ghost){
  this.matrices();const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
  ctx.fillStyle='#bed3dd';ctx.fillRect(0,0,w,h);
  this.path([[-80,-.03,-80],[80,-.03,-80],[80,-.03,80],[-80,-.03,80]],'#d1dfd0');
  if(this.gridOn){ctx.save();ctx.strokeStyle='rgba(54,85,96,.22)';ctx.lineWidth=1;
   for(let i=-36;i<=36;i+=2){for(const [a,b] of [[[i,.02,-36],[i,.02,36]],[[-36,.02,i],[36,.02,i]]]){const p=this.project(a),q=this.project(b);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}}
   ctx.restore();
  }
  const polygons=objects.flatMap(o=>this.faces(o,o.id===selectedId));
  if(ghost)polygons.push(...this.faces(ghost,false,true));
  polygons.sort((a,b)=>b.distance-a.distance);
  for(const f of polygons){
   this.path(f.verts,f.fill,f.stroke,f.alpha);
   if(f.plane){
    const p=f.verts.map(v=>this.project(v)),centerX=(p[0][0]+p[1][0])/2,baseY=(p[0][1]+p[1][1])/2,topY=(p[2][1]+p[3][1])/2;
    const height=Math.max(8,Math.abs(baseY-topY));
    ctx.save();ctx.globalAlpha=f.alpha;ctx.fillStyle=f.kind==='tree'?'#44895f':'#355a7b';ctx.strokeStyle=ctx.fillStyle;
    if(f.kind==='tree'){
     ctx.lineWidth=Math.max(2,height*.09);ctx.beginPath();ctx.moveTo(centerX,baseY);ctx.lineTo(centerX,topY+height*.37);ctx.stroke();ctx.beginPath();ctx.ellipse(centerX,topY+height*.32,Math.max(5,height*.2),height*.3,0,0,Math.PI*2);ctx.fill();
    }else{
     ctx.beginPath();ctx.arc(centerX,topY+height*.12,height*.09,0,Math.PI*2);ctx.fill();ctx.lineWidth=height*.13;ctx.beginPath();ctx.moveTo(centerX,topY+height*.3);ctx.lineTo(centerX,topY+height*.7);ctx.stroke();ctx.lineWidth=Math.max(2,height*.07);ctx.beginPath();ctx.moveTo(centerX,topY+height*.65);ctx.lineTo(centerX-5,baseY);ctx.moveTo(centerX,topY+height*.65);ctx.lineTo(centerX+5,baseY);ctx.stroke();
    }ctx.restore();
   }
  }
 }
 orbit(){}
 pan(dx,dy){const c=this.camera,s=c.distance*.0016;const r=[Math.cos(ISO_YAW),0,-Math.sin(ISO_YAW)],f=[-Math.sin(ISO_YAW),0,-Math.cos(ISO_YAW)];c.target=add(c.target,add(mul(r,-dx*s),mul(f,dy*s)));}
 zoom(delta){this.camera.distance=clamp(this.camera.distance*Math.exp(delta*.0013),8,150);}
 focus(o){this.camera.target=[o?.x||0,(o?.y||0)+(o?.height||0)/3,o?.z||0];}
 fit(){this.camera.target=[0,0,0];this.camera.distance=40;}
}
