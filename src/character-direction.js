/** The four editable Genesis views follow WORLD headings, not the camera. */
export const CHARACTER_VIEWS=Object.freeze(['front','right','back','left']);
export const isCameraBillboard=kind=>kind==='tree';
export function normalizeHeading(degrees=0){
 const n=Number(degrees);
 return Number.isFinite(n)?((n%360)+360)%360:0;
}
export function viewForHeading(degrees=0){
 return CHARACTER_VIEWS[Math.round(normalizeHeading(degrees)/90)%4];
}
export function headingForView(view='front'){
 const i=CHARACTER_VIEWS.indexOf(view);
 if(i<0)throw new Error('Unknown character view: '+view);
 return i*90;
}
