/** Minimal dependency-free 3D math for Laifu. Column-major matrices, Y-up world. */
export const EPS = 1e-6;
export const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
export const vec3 = (x=0,y=0,z=0)=>[x,y,z];
export const add = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul = (a,s)=>a.map(v=>v*s);
export const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm = a=>mul(a,1/(Math.hypot(...a)||1));
export const ident = ()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function multiply(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
export function translation(x,y,z){const m=ident(); m[12]=x;m[13]=y;m[14]=z;return m;}
export function scaling(x,y,z){const m=ident();m[0]=x;m[5]=y;m[10]=z;return m;}
export function rotationY(rad){const m=ident(),c=Math.cos(rad),s=Math.sin(rad);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
export function lookAt(eye,target,up=[0,1,0]){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
export function ortho(l,r,b,t,n,f){return [2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1];}
export function perspective(fovy,aspect,n,f){const v=1/Math.tan(fovy/2);return [v/aspect,0,0,0,0,v,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0];}
export function invert(m){
 let a=Array.from({length:4},(_,r)=>[...Array.from({length:4},(_,c)=>m[c*4+r]),...Array.from({length:4},(_,c)=>+(c===r))]);
 for(let i=0;i<4;i++){let k=i;for(let j=i+1;j<4;j++)if(Math.abs(a[j][i])>Math.abs(a[k][i]))k=j;if(Math.abs(a[k][i])<EPS)return null;[a[i],a[k]]=[a[k],a[i]];let d=a[i][i];for(let j=0;j<8;j++)a[i][j]/=d;for(let r=0;r<4;r++)if(r!==i){const s=a[r][i];for(let j=0;j<8;j++)a[r][j]-=s*a[i][j];}}
 return Array.from({length:16},(_,p)=>a[p%4][4+Math.floor(p/4)]);
}
export function transformPoint(m,p,w=1){const v=[...p,w],o=Array.from({length:4},(_,r)=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);return o.map(x=>x/(o[3]||1)).slice(0,3);}
export function rayFromViewport(clientX,clientY,rect,viewProjection){const inv=invert(viewProjection);if(!inv)return null;const x=((clientX-rect.left)/rect.width)*2-1,y=1-((clientY-rect.top)/rect.height)*2;const a=transformPoint(inv,[x,y,-1]),b=transformPoint(inv,[x,y,1]);return {origin:a,direction:norm(sub(b,a))};}
export function intersectPlane(ray,y=0){if(!ray||Math.abs(ray.direction[1])<EPS)return null;const t=(y-ray.origin[1])/ray.direction[1];if(t<0)return null;return {...{x:ray.origin[0]+ray.direction[0]*t,y,z:ray.origin[2]+ray.direction[2]*t},t};}
/** Slab intersection with axis-aligned box in local coordinates, including local base offset. */
export function intersectBox(ray,min,max){let near=-Infinity,far=Infinity;for(let i=0;i<3;i++){const d=ray.direction[i],v=ray.origin[i];if(Math.abs(d)<EPS){if(v<min[i]||v>max[i])return null;continue;}let a=(min[i]-v)/d,b=(max[i]-v)/d;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(far<near)return null;}return far<0?null:Math.max(0,near);}
export function localRay(ray,entity){const radians=-(entity.rotation||0)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);function r(p){return [p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c]}return {origin:r([ray.origin[0]-entity.x,ray.origin[1]-entity.y,ray.origin[2]-entity.z]),direction:r(ray.direction)};}
export function hitEntity(ray,obj){const p=localRay(ray,obj),thickness=obj.kind==='tree'||obj.kind==='character'?.12:obj.depth;return intersectBox(p,[-obj.width/2,0,-thickness/2],[obj.width/2,obj.height,thickness/2]);}
