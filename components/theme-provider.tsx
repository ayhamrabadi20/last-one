"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson, ClientApiError } from "@/lib/client-api";
export type ThemeMode="light"|"dark"|"system";
const valid=(value:string):value is ThemeMode=>["light","dark","system"].includes(value);
const ThemeContext=createContext<{mode:ThemeMode;setMode:(mode:ThemeMode)=>void;busy:boolean}>({mode:"system",setMode:()=>{},busy:false});
export const useTheme=()=>useContext(ThemeContext);
export const themeInitScript=`(function(){try{var m=(document.cookie.match(/(?:^|; )lifeevent_theme=([^;]*)/)||[])[1]||"system";if(!["light","dark","system"].includes(m))m="system";document.documentElement.dataset.theme=m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m}catch(e){document.documentElement.dataset.theme="light"}})();`;
function apply(mode:ThemeMode){document.documentElement.dataset.theme=mode==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):mode;document.cookie=`lifeevent_theme=${mode};path=/;max-age=31536000;SameSite=Lax`;}
export function ThemeProvider({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const [mode,setModeState]=useState<ThemeMode>("system");
  const [signedIn,setSignedIn]=useState(false);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    const cookie=document.cookie.match(/(?:^|; )lifeevent_theme=([^;]*)/)?.[1]||"system";
    queueMicrotask(()=>{if(active){setModeState(valid(cookie)?cookie:"system");apply(valid(cookie)?cookie:"system");}});
    if(["/login","/register","/forgot-password","/reset-password"].includes(pathname)){queueMicrotask(()=>{if(active){setSignedIn(false);setBusy(false);}});return()=>{active=false;};}
    queueMicrotask(()=>{if(active){setBusy(true);setSignedIn(true);}});
    fetchJson<{theme:ThemeMode}>("/api/preferences").then(result=>{if(active){setSignedIn(true);if(valid(result.theme)){setModeState(result.theme);apply(result.theme);}}}).catch(caught=>{if(active&&caught instanceof ClientApiError&&caught.status===401)setSignedIn(false);}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[pathname]);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const change=()=>{if(mode==="system")apply(mode);};media.addEventListener("change",change);return()=>media.removeEventListener("change",change);},[mode]);
  async function setMode(next:ThemeMode){
    if(busy)return;const previous=mode;setBusy(true);setError("");setModeState(next);apply(next);
    try{if(signedIn)await fetchJson("/api/preferences",{method:"PATCH",body:JSON.stringify({theme:next})});}
    catch{setModeState(previous);apply(previous);setError("تعذر حفظ المظهر في الحساب. حاول مجددًا.");}finally{setBusy(false);}
  }
  return <ThemeContext.Provider value={{mode,setMode,busy}}>{children}{error&&<div role="alert" className="fixed bottom-5 left-5 right-5 z-50 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:right-auto"><button type="button" className="focus-ring ml-3 rounded px-2" onClick={()=>setError("")} aria-label="إغلاق الرسالة">×</button>{error}</div>}</ThemeContext.Provider>;
}
