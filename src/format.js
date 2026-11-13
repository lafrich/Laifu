import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {renderCharacter,croppedSprite} from './render.js';
import {VIEWS,LAIFU_SCALE} from './constants.js';
import {normalizeCharacter} from './model.js';
import {normalizeEmotionDatabase} from './emotion.js';
const encoder=new TextEncoder();
export function filename(s){return (s||'genesis').toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/-+/g,'-').slice(0,64)||'genesis';}
export function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
const pngBytes=async c=>new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer());
export function cleanCharacter(c){const clone=JSON.parse(JSON.stringify(c));for(const v of VIEWS)for(const part of clone.views[v].parts)for(const k of Object.keys(part))if(k.startsWith('_'))delete part[k];return normalizeCharacter(clone);}
export async function exportPackage(c){const char=cleanCharacter(c),slug=filename(char.name);const assets={'character.json':strToU8(JSON.stringify(char,null,2)),'README.txt':encoder.encode(`LAIFU CHARACTER v1\nCategory: Genesis ${char.genesis}\nScale: 1 character = 1 door = ${LAIFU_SCALE.characterHeight} world unit.\n1 level = ${LAIFU_SCALE.levelHeight} world units.\nMinimum building = ${LAIFU_SCALE.minBuildingHeight} world units.\nPlane bottom must be placed at levelSurfaceY.\nImport the ZIP or character.json into Laifu Map.\nAll saving is manual.\n`)};
 for(const view of VIEWS){const canvas=renderCharacter(char,view);assets[`views/${view}.png`]=await pngBytes(canvas);assets[`views/${view}-cropped.png`]=await pngBytes(croppedSprite(canvas).canvas);}
 saveBlob(new Blob([zipSync(assets,{level:6})],{type:'application/zip'}),slug+'.laifu-character.zip');return slug;}
export async function loadCharacterFile(file){let data;if(file.name.toLowerCase().endsWith('.zip')){const zip=unzipSync(new Uint8Array(await file.arrayBuffer()));if(!zip['character.json'])throw new Error('ZIP tidak memiliki character.json');data=JSON.parse(strFromU8(zip['character.json']));}else data=JSON.parse(await file.text());return normalizeCharacter(data);}

export async function loadEmotionFile(file){
 let raw;
 if(file.name.toLowerCase().endsWith('.zip')){
  const z=unzipSync(new Uint8Array(await file.arrayBuffer()));
  const bytes=z['database.json']||z['emotion.json'];
  if(!bytes)throw Error('ZIP Emosi tidak memiliki database.json');
  raw=JSON.parse(strFromU8(bytes));
 }else raw=JSON.parse(await file.text());
 return normalizeEmotionDatabase(raw);
}
