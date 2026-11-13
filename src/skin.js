/** Semantic skin pixels are stored as tokens, not baked RGB values.
 * The same 3 color slots apply to all directions and rig body parts.
 */
export const SKIN_TOKENS=Object.freeze({base:'@skin/base',light:'@skin/light',shadow:'@skin/shadow'});
export const DEFAULT_SKIN_KEY=Object.freeze({base:'#d99b7a',light:'#f4c6a6',shadow:'#9b614d'});
export const SKIN_PRESETS=Object.freeze({
 natural:{base:'#d99b7a',light:'#f4c6a6',shadow:'#9b614d'},
 fair:{base:'#efc9af',light:'#ffe5ce',shadow:'#ba8e77'},
 medium:{base:'#b77c5b',light:'#d9a181',shadow:'#82513d'},
 tan:{base:'#946142',light:'#bc865e',shadow:'#623c2c'},
 deep:{base:'#674333',light:'#8c6048',shadow:'#422a24'}
});
const HEX=/^#[0-9a-f]{6}$/i;
export const normalizeSkinKey=(value={})=>Object.fromEntries(Object.entries(DEFAULT_SKIN_KEY).map(([key,fallback])=>[key,typeof value?.[key]==='string'&&HEX.test(value[key])?value[key].toLowerCase():fallback]));
export const resolveSkinColor=(value,skinKey=DEFAULT_SKIN_KEY)=>{
 if(typeof value==='string'&&value.startsWith('@skin/')){
  const slot=value.slice(6);return normalizeSkinKey(skinKey)[slot]||'#ff00ff';
 }
 return typeof value==='string'&&HEX.test(value)?value:'#ff00ff';
};
const SKIN_PARTS=new Set(['head','torso','forearmL','forearmR','handL','handR']);
const LEGACY_COLORS={base:'#d99b7a',light:'#f4c6a6',shadow:'#9b614d'};
export function convertLegacySkinPixels(character){
 for(const view of Object.values(character.views||{})){
  for(const part of view.parts||[]){
   if(!SKIN_PARTS.has(part.id))continue;
   for(const [position,color] of Object.entries(part.pixels||{})){
    for(const [slot,hex] of Object.entries(LEGACY_COLORS)){
     if(typeof color==='string'&&color.toLowerCase()===hex){part.pixels[position]=SKIN_TOKENS[slot];break;}
    }
   }
  }
 }
 return character;
}
