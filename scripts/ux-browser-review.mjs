import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import WebSocket from "next/dist/compiled/ws/index.js";
import { randomBytes } from "node:crypto";
import { MongoClient } from "mongodb";
const base=process.env.UI_BASE_URL||"http://127.0.0.1:3105";
const output=resolve(".local-data/ux-review");mkdirSync(output,{recursive:true});
const profile=mkdtempSync(join(tmpdir(),"lifeevent-ux-"));
const port=9341;
const browser=spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",["--headless=new","--disable-gpu","--no-first-run",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"],{stdio:"ignore",windowsHide:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const keepAlive=setInterval(()=>{},1000);
let socket;let cookie;const results=[];const errors=[];
const checks=[];
const email=`ux-review-${randomBytes(6).toString("hex")}@example.com`;
const password=randomBytes(20).toString("hex");
// Sample solid surfaces only; this does not replace a complete WCAG audit.
function sampleContrast(){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=1;const ctx=canvas.getContext("2d");
 const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
 const blend=(top,bottom)=>top.slice(0,3).map((v,i)=>v*top[3]+bottom[i]*(1-top[3]));
 const lum=color=>color.map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
 return ['button[aria-pressed="true"]','[role="status"].bg-emerald-50','.bg-teal-800.text-white .text-teal-100','.auth-label'].flatMap(selector=>{const el=document.querySelector(selector);if(!el)return [];let background=[255,255,255];const ancestors=[];for(let node=el;node;node=node.parentElement)ancestors.unshift(node);for(const node of ancestors)background=blend(rgba(getComputedStyle(node).backgroundColor),background);const foreground=blend(rgba(getComputedStyle(el).color),background);const a=lum(foreground),b=lum(background);return [{selector,ratio:Number(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2))}];});
}
try {
 let target;
 for(let i=0;i<40;i++){try{const list=await (await fetch(`http://127.0.0.1:${port}/json`)).json();target=list.find(t=>t.type==="page");if(target)break;}catch{}await delay(250);}
 if(!target)throw Error("Browser debugger unavailable");
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error("Browser connection timeout")),10000);socket.addEventListener("open",()=>{clearTimeout(timer);res();},{once:true});socket.addEventListener("error",()=>{clearTimeout(timer);rej(Error("Browser connection failed"));},{once:true});});
 let seq=0;const pending=new Map();
 socket.addEventListener("message",event=>{const message=JSON.parse(event.data);if(message.id){const item=pending.get(message.id);if(item){pending.delete(message.id);clearTimeout(item.timer);if(message.error)item.reject(Error(message.error.message));else item.resolve(message.result);}}else if(message.method==="Runtime.exceptionThrown")errors.push(message.params.exceptionDetails.text);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`Browser command timed out: ${method}`));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 await send("Runtime.enable");await send("Page.enable");await send("Network.enable");
 const evaluate=async expression=>(await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true})).result.value;
 async function capture(path,name,width,mode,height=900){
   await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});
   await send("Page.navigate",{url:base+path});await delay(1400);
   await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(mode)}`);
   await delay(350);
   const metrics=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,title:document.title,headings:[...document.querySelectorAll('h1')].map(n=>n.textContent),theme:document.documentElement.dataset.theme,skipTarget:!document.querySelector('.skip-link')||!!document.querySelector('#main-content'),submitBottom:document.querySelector('form[aria-label="وصف هدف المشروع"] button[type="submit"],form[aria-label="تسجيل الدخول"] .auth-submit')?.getBoundingClientRect().bottom,unlabelled:[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).length})`);
   metrics.contrast=await evaluate(`(${sampleContrast.toString()})()`);
   const shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
   const vertical=await evaluate(`({scrollHeight:document.documentElement.scrollHeight,height:innerHeight,formScroll:document.querySelector('.login-form-area')?document.querySelector('.login-form-area').scrollHeight-document.querySelector('.login-form-area').clientHeight:0})`);
   writeFileSync(join(output,`${name}-${width}-${mode}.png`),Buffer.from(shot.data,"base64"));results.push({page:name,...metrics,...vertical,overflow:metrics.scrollWidth>width});
 }
 if(process.env.UI_LOGIN_LAYOUT_ONLY==="true"||process.env.UI_REGISTER_LAYOUT_ONLY==="true"){
  const page=process.env.UI_REGISTER_LAYOUT_ONLY==="true"?"register":"login";
  for(const [width,height] of [[1440,900],[1366,768],[1024,600],[390,844],[360,640],[320,568]])for(const mode of ["light","dark"])await capture(`/${page}`,`${page}-${height}`,width,mode,height);
  writeFileSync(join(output,`${page}-layout-results.json`),JSON.stringify(results,null,2));
  const issues=results.filter(r=>r.overflow||r.scrollHeight>r.height||r.formScroll>1);
  console.log(JSON.stringify({views:results.length,issues,errors}));
  if(issues.length||errors.length)throw Error("Login layout failed viewport checks");
  if(page==="register"){
   await evaluate(`for(const [id,value] of Object.entries(${JSON.stringify({name:"مستخدم التجربة",phone:"0791234567",email,password,confirmPassword:password})}))document.getElementById(id).value=value;document.querySelector('form').requestSubmit();`);
   await delay(1600);
   const success=await evaluate(`location.pathname==='/profile'&&document.body.textContent.includes('مستخدم التجربة')`);
   console.log(JSON.stringify({registrationFormSubmitted:success}));
   if(!success)throw Error("Registration form did not complete");
   const stored=await send("Network.getCookies",{urls:[base]});const session=stored.cookies.find(item=>item.name==="lifeevent_session");if(session)cookie=`${session.name}=${session.value}`;
  }
 }else{
 await capture("/login","login",390,"light");await capture("/login","login",1440,"dark");await capture("/login","login",320,"light");
 const response=await fetch(base+"/api/auth/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:"مستخدم التجربة",email,phone:"0791234567",password})});
 if(!response.ok)throw Error(`Test registration failed (${response.status})`);
 cookie=response.headers.get("set-cookie").split(";")[0];
 await evaluate(`document.querySelector('#email').value=${JSON.stringify(email)};document.querySelector('#password').value=${JSON.stringify(password)};document.querySelector('form').requestSubmit();`);
 await delay(1700);
 checks.push({name:"login form opens the homepage",passed:await evaluate(`location.pathname==='/'&&!!document.querySelector('#goal')`)});
 const [name,value]=cookie.split("=");await send("Network.setCookie",{name,value,url:base,httpOnly:true,sameSite:"Lax"});
 for(const [path,name] of [["/","home"],["/profile","profile"],["/history","history"],["/support","support"],["/sources","sources"],["/explore?goal="+encodeURIComponent("بدي أفتح محل حلويات بخلدا"),"explore"],["/journey?activityId=clothing-retail&municipalityId=amman&legalForm=sole-proprietorship&premisesTenure=rent","journey"]])for(const width of [390,1440])for(const mode of ["light","dark"])await capture(path,name,width,mode);
 await capture("/","home",320,"light");
 await send("Page.navigate",{url:base+"/"});await delay(1200);
 await evaluate(`document.querySelector('[aria-controls="mobile-navigation"]').focus();document.querySelector('[aria-controls="mobile-navigation"]').click()`);
 await delay(100);await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});await delay(150);
 checks.push({name:"Escape closes the menu and restores focus",passed:await evaluate(`!document.querySelector('#mobile-navigation')&&document.activeElement?.getAttribute('aria-controls')==='mobile-navigation'`)});
 await evaluate(`document.querySelector('[aria-controls="mobile-navigation"]').click();`);await delay(150);await evaluate(`const s=[...document.querySelectorAll('select[aria-label="مظهر الموقع"]')].find(e=>e.getClientRects().length);s.value='dark';s.dispatchEvent(new Event('change',{bubbles:true}));`);await delay(650);
 checks.push({name:"appearance selection persists to the signed-in account",passed:await evaluate(`fetch('/api/preferences').then(r=>r.json()).then(d=>d.theme==='dark')`)});
 await send("Page.navigate",{url:base+"/profile"});await delay(1200);
 checks.push({name:"saved dark appearance survives navigation",passed:await evaluate(`document.documentElement.dataset.theme==='dark'`)});
 await send("Page.navigate",{url:base+"/history"});await delay(1200);
 const before=await evaluate(`fetch('/api/profile').then(r=>r.json()).then(d=>d.stats.requests)`);
 await evaluate(`document.querySelector('details summary')?.click()`);
 checks.push({name:"history opens the stored details without another generation",passed:await evaluate(`!!document.querySelector('details[open]')`)});
 const after=await evaluate(`fetch('/api/profile').then(r=>r.json()).then(d=>d.stats.requests)`);
 checks.push({name:"reading history creates no new interactions",passed:before===after});
 await send("Page.navigate",{url:base+"/?mode=ask"});await delay(1200);
 await evaluate(`window.uxOriginalFetch=window.fetch;window.fetch=function(input,init){if(String(input)==='/api/answer')return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));return window.uxOriginalFetch(input,init)};const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(document.querySelector('#goal'),'شو الوثيقة المطلوبة للمحل المستأجر؟');document.querySelector('#goal').dispatchEvent(new Event('input',{bubbles:true}));`);
 await delay(100);await evaluate(`document.querySelector('form[aria-label="وصف هدف المشروع"]').requestSubmit()`);await delay(250);
 checks.push({name:"waiting disables editing of the in-flight question",passed:await evaluate(`document.querySelector('#goal').disabled`)});
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='إيقاف الانتظار')?.click()`);await delay(200);
 checks.push({name:"cancel restores control and explains the result",passed:await evaluate(`!document.querySelector('#goal').disabled&&document.body.textContent.includes('تم إيقاف الانتظار')`)});
 await evaluate(`window.fetch=window.uxOriginalFetch`);
 const lowContrast=results.flatMap(result=>result.contrast.filter(sample=>sample.ratio<4.5).map(sample=>({page:result.page,theme:result.theme,...sample})));
 console.log(JSON.stringify({pages:results.length,checks,overflows:results.filter(r=>r.overflow),unlabelled:results.filter(r=>r.unlabelled),lowContrast,browserErrors:errors,output}));
 writeFileSync(join(output,"results.json"),JSON.stringify({results,checks,errors},null,2));
 if(checks.some(check=>!check.passed)||results.some(r=>r.overflow||r.unlabelled||!r.skipTarget)||lowContrast.length||errors.length)throw Error("UX browser checks failed; inspect results.json");
 }
} finally {
 if(cookie){await fetch(base+"/api/auth/logout",{method:"POST",headers:{cookie},redirect:"manual"}).catch(()=>{});}
 socket?.close();browser.kill();clearInterval(keepAlive);await delay(700);
 const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
 try {await client.connect();const db=client.db(process.env.MONGODB_DB_NAME||"lifeevent_ai");for(const name of ["sessions","interactions","checklists","support_tickets"])await db.collection(name).deleteMany({userId:email});await db.collection("accounts").deleteMany({email});}finally{await client.close();}
 if(resolve(profile).startsWith(resolve(tmpdir())+"\\")&&profile.includes("lifeevent-ux-"))try{rmSync(profile,{recursive:true,force:true});}catch{}
}
