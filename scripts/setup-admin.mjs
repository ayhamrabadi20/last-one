import { MongoClient } from "mongodb";
import { randomBytes, scryptSync } from "node:crypto";
const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const email = (process.env.ADMIN_EMAIL || "admin@lifeevent.local").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!process.env.MONGODB_URI || !password || password.length < 12) throw new Error("Configure MONGODB_URI and ADMIN_PASSWORD (12+ characters) in .env.local.");
if (!/^[a-z0-9_-]{3,40}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid ADMIN_USERNAME or ADMIN_EMAIL.");
const client = new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "lifeevent_ai");
  const accounts = db.collection("accounts");
  await accounts.createIndex({email:1},{unique:true});
  await accounts.createIndex({username:1},{unique:true,sparse:true});
  const existing = await accounts.findOne({$or:[{username},{email}]});
  if (existing && existing.role !== "admin") throw new Error("This identity belongs to a regular user; choose a different admin username and email.");
  if (!existing) {
    const salt = randomBytes(16).toString("hex");
    await accounts.insertOne({username,email,name:"مدير المنصة",phone:"",role:"admin",status:"active",protectedAdmin:true,sessionVersion:0,passwordHash:`${salt}:${scryptSync(password,salt,64).toString("hex")}`,createdAt:new Date()});
  }
  else { await accounts.updateOne({_id:existing._id},{$set:{protectedAdmin:true}}); }
  await db.collection("admin_audit").createIndex({createdAt:-1});
  await db.collection("support_tickets").createIndex({status:1,createdAt:-1});
  await db.collection("accounts").createIndex({createdAt:-1});
  console.log(JSON.stringify({adminUsername:username,created:!existing,passwordUnchanged:!!existing}));
} finally {await client.close();}
