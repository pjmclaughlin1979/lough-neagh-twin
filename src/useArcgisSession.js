import {useCallback,useEffect,useState} from 'react';
import {arcgisSdk,startArcgisSession} from './arcgis-auth';
export default function useArcgisSession(){
 const [state,setState]=useState('checking'),[error,setError]=useState('');
 const connect=useCallback(async(force=false)=>{
  setState('checking');setError('');
  try{
   const {IdentityManager}=await arcgisSdk();let storage;
   try{storage=window.sessionStorage}catch{}
   // Local development has no registered OAuth callback. Production starts login automatically.
   const ready=await startArcgisSession(IdentityManager,storage,{automatic:import.meta.env.PROD,force});
   setState(ready?'ready':'signedOut');
  }catch(e){setError(e.message||'Sign-in was cancelled.');setState('signedOut')}
 },[]);
 useEffect(()=>{connect()},[connect]);
 return {state,error,signIn:()=>connect(true)};
}
