import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
const base=process.env.VERIFY_BASE_URL||"http://127.0.0.1:3104";
const email=`verify-${randomBytes(6).toString("hex")}@example.com`;
const password=randomBytes(20).toString("hex");
const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
let id;let checks=0;
async function call(path,method="GET",body,cookie){const response=await fetch(base+path,{method,redirect:"manual",headers:{...(body?{"content-type":"application/json"}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=response.headers.get("content-type")?.includes("application/json")?await response.json():null;return {status:response.status,data,cookie:response.headers.get("set-cookie")?.split(";")[0]};}
function status(actual,expected){assert.equal(actual.status,expected);checks++;}
try {
 await client.connect();const db=client.db(process.env.MONGODB_DB_NAME||"lifeevent_ai");
 const admin=await call("/api/auth/login","POST",{username:process.env.ADMIN_USERNAME||"admin",password:process.env.ADMIN_PASSWORD});status(admin,200);assert.ok(admin.cookie);
 const registered=await call("/api/auth/register","POST",{email,password,name:"Verification Account",phone:"0791234567",role:"admin"});status(registered,200);
 const account=await db.collection("accounts").findOne({email});id=account._id.toString();assert.equal(account.role,"user");checks++;
 const normalLogin=await call("/api/auth/login","POST",{username:email,password});status(normalLogin,200);assert.equal(normalLogin.data.redirectTo,"/");checks++;
 assert.equal(admin.data.redirectTo,"/admin");checks++;
 const flow=randomUUID();
 const postFlow=(path,body)=>fetch(base+path,{method:"POST",headers:{"content-type":"application/json",cookie:registered.cookie,"x-request-id":flow},body:JSON.stringify(body)});
 const intake=await postFlow("/api/intake",{goal:"بدي افتح محل ملابس مستأجر بعمان كمؤسسة فردية",slots:{activityId:"clothing-retail",municipalityId:"amman",legalForm:"sole-proprietorship",premisesTenure:"rent"}});assert.equal(intake.status,200);checks++;
 const body={slots:{activityId:"clothing-retail",municipalityId:"amman",legalForm:"sole-proprietorship",premisesTenure:"rent"}};
 const repeated=await Promise.all(Array.from({length:4},()=>postFlow("/api/journey",body)));
 for(const response of repeated){assert.equal(response.status,200);checks++;}
 assert.equal(await db.collection("interactions").countDocuments({userId:email}),1);checks++;
 const saved=await db.collection("interactions").findOne({userId:email});assert.equal(saved.type,"journey");assert.equal(saved.input,"بدي افتح محل ملابس مستأجر بعمان كمؤسسة فردية");checks+=2;
 const change=(action,extra={})=>call("/api/admin/users","POST",{id,action,...extra},admin.cookie);
 status(await call("/api/admin","GET",undefined,registered.cookie),403);
 status(await call("/api/preferences","PATCH",{theme:"dark"},registered.cookie),200);
 assert.equal((await call("/api/preferences","GET",undefined,registered.cookie)).data.theme,"dark");checks++;
 status(await change("ban"),200);
 status(await call("/api/profile","GET",undefined,registered.cookie),401);
 status(await call("/api/auth/login","POST",{username:email,password}),401);
 status(await change("activate"),200);
 status(await call("/api/profile","GET",undefined,registered.cookie),401);
 let current=await call("/api/auth/login","POST",{username:email,password});status(current,200);
 status(await change("role",{role:"admin"}),200);
 status(await call("/api/admin","GET",undefined,current.cookie),401);
 current=await call("/api/auth/login","POST",{username:email,password});status(current,200);
 status(await call("/api/admin","GET",undefined,current.cookie),200);
 status(await change("role",{role:"user"}),200);
 status(await call("/api/admin","GET",undefined,current.cookie),401);
 const main=await db.collection("accounts").findOne({username:process.env.ADMIN_USERNAME||"admin"});
 status(await call("/api/admin/users","POST",{id:main._id.toString(),action:"ban"},admin.cookie),409);
 await Promise.all(["interactions","checklists","support_tickets"].map(name=>db.collection(name).insertOne({userId:email,verification:true})));
 status(await change("delete",{confirmation:email}),200);
 for(const name of ["interactions","checklists","support_tickets"]) {assert.equal(await db.collection(name).countDocuments({userId:email}),0);checks++;}
 assert.equal(await db.collection("accounts").countDocuments({email}),0);checks++;
 const recreated=await call("/api/auth/register","POST",{email,password,name:"Verification Account",phone:"0791234567"});status(recreated,200);
 status(await call("/api/profile","GET",undefined,current.cookie),401);
 status(await call("/api/auth/logout","POST",undefined,recreated.cookie),303);
 status(await call("/api/profile","GET",undefined,recreated.cookie),401);
 console.log(JSON.stringify({passed:true,checks,scope:"MongoDB + production HTTP account management and themes"}));
} finally {
 const db=client.db(process.env.MONGODB_DB_NAME||"lifeevent_ai");
 const accounts=await db.collection("accounts").find({email}).toArray();
 await db.collection("sessions").deleteMany({$or:[{userId:email},{accountId:{$in:[id,...accounts.map(a=>a._id.toString())].filter(Boolean)}}]});
 await db.collection("accounts").deleteMany({email});
 for(const name of ["interactions","checklists","support_tickets"]) await db.collection(name).deleteMany({userId:email});
 if(id)await db.collection("admin_audit").deleteMany({targetId:id});
 await client.close();
}
