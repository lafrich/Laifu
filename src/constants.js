export const LAIFU_SCALE = Object.freeze({doorUnits:2,characterHeight:2,levelHeight:4,minBuildingHeight:4});
export const FRAME={width:64,height:112,footX:32,footY:107};
export const VIEWS=['front','left','right','back'];
export const PALETTE=['#f4c6a6','#d99b7a','#9b614d','#24364c','#46627a','#6f9baa','#25273c','#444866','#f0dfce','#ffffff','#d1586b','#c0b17c','#161924','#000000'];
export const PARTS=[
 {id:'pelvis',label:'Pelvis',parent:null,pivot:[32,70],z:4},
 {id:'thighL',label:'Paha L',parent:'pelvis',pivot:[28,75],z:2},
 {id:'calfL',label:'Betis L',parent:'thighL',pivot:[28,89],z:2},
 {id:'footL',label:'Kaki L',parent:'calfL',pivot:[28,102],z:3},
 {id:'thighR',label:'Paha R',parent:'pelvis',pivot:[36,75],z:3},
 {id:'calfR',label:'Betis R',parent:'thighR',pivot:[36,89],z:3},
 {id:'footR',label:'Kaki R',parent:'calfR',pivot:[36,102],z:4},
 {id:'torso',label:'Torso',parent:'pelvis',pivot:[32,65],z:6},
 {id:'upperArmL',label:'Lengan atas L',parent:'torso',pivot:[23,45],z:5},
 {id:'forearmL',label:'Lengan bawah L',parent:'upperArmL',pivot:[19,58],z:5},
 {id:'handL',label:'Tangan L',parent:'forearmL',pivot:[18,71],z:5},
 {id:'upperArmR',label:'Lengan atas R',parent:'torso',pivot:[41,45],z:7},
 {id:'forearmR',label:'Lengan bawah R',parent:'upperArmR',pivot:[45,58],z:7},
 {id:'handR',label:'Tangan R',parent:'forearmR',pivot:[46,71],z:7},
 {id:'head',label:'Kepala',parent:'torso',pivot:[32,40],z:8},
 {id:'face',label:'Wajah',parent:'head',pivot:[32,31],z:9},
 {id:'hair',label:'Rambut',parent:'head',pivot:[32,25],z:10}
];
