import { MongoClient } from "mongodb";
const args=process.argv.slice(2);const preview=args.includes("--preview");const scope=args.filter(arg=>arg!=="--preview");
if(!((scope.length===1&&scope[0]==="--all")||(scope.length===2&&scope[0]==="--user"&&scope[1].trim())))throw Error("Choose --all or --user <email-or-username>; add --preview to count without deleting.");
const filter=scope[0]==="--all"?{}:{userId:scope[1].trim().toLowerCase()};
const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
try{
 await client.connect();const db=client.db(process.env.MONGODB_DB_NAME||"lifeevent_ai");const collection=db.collection("interactions");
 const count=await collection.countDocuments(filter);
 if(preview){console.log(JSON.stringify({preview:true,scope:scope[0],requests:count}));}
 else{
  const actor=process.env.ADMIN_USERNAME?.trim().toLowerCase()||"admin";const admin=await db.collection("accounts").findOne({username:actor,role:"admin",status:{$nin:["banned","suspended","deleted"]}});
  if(!admin)throw Error("An active configured administrator is required.");
  const audit=await db.collection("admin_audit").insertOne({actor,action:"history_clear",targetId:filter.userId||"all",status:"attempted",details:{scope:scope[0],count},createdAt:new Date()});
  const result=await collection.deleteMany(filter);
  await db.collection("admin_audit").updateOne({_id:audit.insertedId},{$set:{status:"completed","details.deleted":result.deletedCount}});
  console.log(JSON.stringify({deleted:result.deletedCount,remaining:await collection.countDocuments(filter),accountsPreserved:true}));
 }
}finally{await client.close();}
