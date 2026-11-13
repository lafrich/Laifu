import * as THREE from 'three';
import {renderCharacter,croppedSprite} from './render.js';
import {LAIFU_SCALE} from './constants.js';
import {normalizeCharacter} from './model.js';
/** The entire visible body, rather than the 112px workframe, is exactly 1 door unit. */
export function createCharacterPlane(character,view='front'){
 normalizeCharacter(character);
 const rendered=renderCharacter(character,view),crop=croppedSprite(rendered);
 const texture=new THREE.CanvasTexture(crop.canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 const width=LAIFU_SCALE.characterHeight*(crop.bounds.width/crop.bounds.height);
 const geometry=new THREE.PlaneGeometry(width,LAIFU_SCALE.characterHeight);
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.01,side:THREE.DoubleSide,depthWrite:false});
 const mesh=new THREE.Mesh(geometry,material);mesh.name=`LaifuCharacter_${character.name}_${view}`;
 mesh.userData={type:'laifu-character',genesis:character.genesis,view,footOnGround:true,height:LAIFU_SCALE.characterHeight,sourceFormat:character.format};
 return mesh;
}
/** World Y at a level surface + half of character visual height; feet sit on surface. */
export function placeCharacterPlane(mesh,x,z,level=0){const lv=Number(level);if(!Number.isInteger(lv)||lv<0)throw new Error('Level harus nonnegative integer');mesh.position.set(x,lv*LAIFU_SCALE.levelHeight+LAIFU_SCALE.characterHeight/2,z);mesh.userData.level=lv;return mesh;}
export function faceCharacterPlaneToCamera(mesh,camera){mesh.rotation.set(0,Math.atan2(camera.position.x-mesh.position.x,camera.position.z-mesh.position.z),0);}
