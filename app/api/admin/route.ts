import { NextResponse } from "next/server";
import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { authorizeAdmin } from "@/lib/admin-auth";
import { requireDatabase } from "@/lib/mongodb";
import { apiError } from "@/lib/schemas";
import { rateLimit, requestKey } from "@/lib/rate-limit";
const iso = (date: unknown) => date instanceof Date ? date.toISOString() : null;
const user = (row: Document) => ({ id:row._id.toString(),name:row.name,email:row.email,phone:row.phone,username:row.username,role:row.role === "admin" ? "admin" : "user",status:row.status || "active",protectedAdmin:!!row.protectedAdmin,createdAt:iso(row.createdAt) });
const ticket = (row: Document) => ({ id:row._id.toString(),subject:row.subject,message:row.message,category:row.category,status:row.status,context:row.context,interactionId:row.interactionId,userId:row.userId,contact:row.contact,createdAt:iso(row.createdAt),replies:(row.replies || []).map((reply: Document)=>({text:reply.text,createdAt:iso(reply.createdAt)})) });
const querySchema=z.object({ view:z.enum(["overview","users","tickets","audit"]).default("overview"),page:z.coerce.number().int().min(1).max(10000).default(1),search:z.string().trim().max(100).default(""),status:z.enum(["all","new","in_progress","resolved"]).default("all") });
const safeRegex=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const userProjection={name:1,email:1,phone:1,username:1,role:1,status:1,protectedAdmin:1,createdAt:1};
export async function GET(request:Request) {
  const access=await authorizeAdmin(request);
  if(access.response)return access.response;
  const parsed=querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success)return NextResponse.json(apiError("INVALID_QUERY","خيارات البحث غير صالحة."),{status:400});
  try {
    const db=await requireDatabase(); const {view,page,search,status}=parsed.data;
    if(view==="overview") {
      const now=new Date(); const month=new Date(now.getTime()-30*86400000); const week=new Date(now.getTime()-7*86400000);
      const dayString=(value:number)=>new Date(value+3*3600000).toISOString().slice(0,10);
      const dates=Array.from({length:14},(_,i)=>dayString(now.getTime()-(13-i)*86400000));
      const since=new Date(`${dates[0]}T00:00:00+03:00`);
      const daily=(collection:string)=>db.collection(collection).aggregate([{$match:{createdAt:{$gte:since}}},{$group:{_id:{$dateToString:{format:"%Y-%m-%d",date:"$createdAt",timezone:"Asia/Amman"}},count:{$sum:1}}}]).toArray();
      const [users,admins,newUsers,requests,active,openTickets,resolvedTickets,checklists,userDays,requestDays,requestTypes,recentUsers,recentTickets]=await Promise.all([
        db.collection("accounts").countDocuments(),db.collection("accounts").countDocuments({role:"admin"}),db.collection("accounts").countDocuments({createdAt:{$gte:week}}),db.collection("interactions").countDocuments(),
        db.collection("interactions").aggregate([{$match:{createdAt:{$gte:month}}},{$group:{_id:"$userId"}},{$count:"count"}]).toArray(),
        db.collection("support_tickets").countDocuments({status:{$in:["new","in_progress"]}}),db.collection("support_tickets").countDocuments({status:"resolved"}),db.collection("checklists").countDocuments(),daily("accounts"),daily("interactions"),
        db.collection("interactions").aggregate([{$group:{_id:"$type",count:{$sum:1}}},{$sort:{count:-1}}]).toArray(),
        db.collection("accounts").find({}, {projection:userProjection}).sort({createdAt:-1}).limit(5).toArray(),
        db.collection("support_tickets").find({status:{$in:["new","in_progress"]}}).sort({createdAt:-1}).limit(5).toArray(),
      ]);
      return NextResponse.json({totals:{users,admins,newUsers,requests,activeUsers:active[0]?.count||0,openTickets,resolvedTickets,checklists},trend:dates.map(date=>({date,users:userDays.find(row=>row._id===date)?.count||0,requests:requestDays.find(row=>row._id===date)?.count||0})),requestTypes:requestTypes.map(row=>({type:row._id,count:row.count})),recentUsers:recentUsers.map(user),recentTickets:recentTickets.map(ticket),updatedAt:now.toISOString()});
    }
    const filter:Document={};
    if(view==="tickets"&&status!=="all")filter.status=status;
    if(search) {
      const pattern={$regex:safeRegex(search),$options:"i"};
      const fields=view==="users"?["name","email","username"]:view==="tickets"?["subject","contact.name","contact.email"]:["actor","action","targetId"];
      filter.$or=fields.map(field=>({[field]:pattern}));
    }
    const collection=db.collection(view==="users"?"accounts":view==="tickets"?"support_tickets":"admin_audit");
    const [rows,total]=await Promise.all([collection.find(filter,view==="users"?{projection:userProjection}:{}).sort({createdAt:-1}).skip((page-1)*20).limit(20).toArray(),collection.countDocuments(filter)]);
    const items=view==="users"?rows.map(user):view==="tickets"?rows.map(ticket):rows.map(row=>({id:row._id.toString(),actor:row.actor,action:row.action,targetId:row.targetId,status:row.status,createdAt:iso(row.createdAt)}));
    return NextResponse.json({items,total,page,pages:Math.max(1,Math.ceil(total/20))});
  } catch {return NextResponse.json(apiError("STORAGE_UNAVAILABLE","تعذر تحميل بيانات اللوحة. حاول مجددًا."),{status:503});}
}
const updateSchema=z.object({id:z.string().regex(/^[a-f0-9]{24}$/i),status:z.enum(["new","in_progress","resolved"]),reply:z.string().trim().max(4000).default("")});
export async function PATCH(request:Request) {
  const access=await authorizeAdmin(request);
  if(access.response)return access.response;
  if(!rateLimit(`admin:${requestKey(request)}`).allowed)return NextResponse.json(apiError("RATE_LIMITED","انتظر قليلًا ثم حاول مجددًا."),{status:429});
  // Reject cross-origin mutations even if a client manages to attach cookies.
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return NextResponse.json(apiError("FORBIDDEN","مصدر الطلب غير مسموح."),{status:403});
  const parsed=updateSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json(apiError("INVALID_UPDATE","تحقق من حالة الرسالة ونص الرد."),{status:400});
  try {
    const db=await requireDatabase(); const {id,status,reply}=parsed.data;
    if(!await db.collection("support_tickets").findOne({_id:new ObjectId(id)}))return NextResponse.json(apiError("NOT_FOUND","الرسالة غير موجودة."),{status:404});
    const audit=await db.collection("admin_audit").insertOne({actor:access.session.sub,action:"ticket_update",targetId:id,status:"attempted",details:{status,replyAdded:!!reply},createdAt:new Date()});
    const update:Document={$set:{status,updatedAt:new Date()}};
    if(reply)update.$push={replies:{text:reply,adminId:access.session.sub,createdAt:new Date()}};
    const changed=await db.collection("support_tickets").updateOne({_id:new ObjectId(id)},update);
    await db.collection("admin_audit").updateOne({_id:audit.insertedId},{$set:{status:changed.matchedCount?"completed":"not_found"}});
    if(!changed.matchedCount)return NextResponse.json(apiError("NOT_FOUND","الرسالة غير موجودة."),{status:404});
    return NextResponse.json({ok:true});
  } catch {return NextResponse.json(apiError("STORAGE_UNAVAILABLE","تعذر تأكيد تحديث الرسالة. حدّث القائمة قبل إعادة إرسال الرد."),{status:503});}
}
