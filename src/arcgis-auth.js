export const ARCGIS_APP_ID='CTbgT2f2BGjoPKMO';
export const PORTAL_SHARING='https://www.arcgis.com/sharing';
const ATTEMPT_KEY='lough-neagh-oauth-attempt';
let sdk;
export function arcgisSdk(){
 if(!sdk)sdk=(async()=>{
  for(let i=0;i<200&&!window.$arcgis;i++)await new Promise(r=>setTimeout(r,100));
  if(!window.$arcgis)throw Error('ArcGIS SDK did not load. Please reload the page.');
  const [IdentityManager,OAuthInfo,request]=await window.$arcgis.import(['@arcgis/core/identity/IdentityManager.js','@arcgis/core/identity/OAuthInfo.js','@arcgis/core/request.js']);
  IdentityManager.registerOAuthInfos([new OAuthInfo({appId:ARCGIS_APP_ID,portalUrl:'https://www.arcgis.com',popup:false})]);
  return {IdentityManager,request};
 })().catch(e=>{sdk=null;throw e});
 return sdk;
}
// Mark before redirect, so cancelling/back navigation cannot create a redirect loop.
export async function startArcgisSession(identity,storage,{automatic=true,force=false}={}){
 try{await identity.checkSignInStatus(PORTAL_SHARING);try{storage?.removeItem(ATTEMPT_KEY)}catch{}return true}catch{}
 if(!force){
  if(!automatic)return false;
  try{if(!storage||storage.getItem(ATTEMPT_KEY))return false;storage.setItem(ATTEMPT_KEY,'1')}catch{return false}
 }else{try{storage?.setItem(ATTEMPT_KEY,'1')}catch{}}
 await identity.getCredential(PORTAL_SHARING);
 try{storage?.removeItem(ATTEMPT_KEY)}catch{}
 return true;
}
