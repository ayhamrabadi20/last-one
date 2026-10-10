"use client";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
export function RequestWaiting({onCancel}:{onCancel:()=>void}) {
 const [seconds,setSeconds]=useState(0);
 useEffect(()=>{const started=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[]);
 return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4"><div className="flex items-center gap-3 text-sm text-teal-900"><LoaderCircle className="animate-spin" size={20}/><div><p role="status" className="font-bold">جارٍ فهم الطلب والبحث في المصادر…</p><p aria-live="off" className="mt-1 text-xs text-teal-700">الوقت المنقضي: {seconds} ثانية. مدة الانتظار تختلف حسب الطلب.</p></div></div><button type="button" onClick={onCancel} className="focus-ring min-h-11 rounded-xl border border-teal-200 bg-white px-4 py-2 text-xs font-bold text-teal-800">إيقاف الانتظار</button></div>;
}
